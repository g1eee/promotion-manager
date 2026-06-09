/**
 * ProductService — Product_Master management, owned per Brand (Req 3, Req 23).
 *
 * Responsibilities (design "Components and Interfaces → Product Master"):
 * - `create` validates the required Product fields, enforces uniqueness SOLELY
 *   on the `(brandId, productId)` combination (Req 3.2, 3.4), validates that the
 *   owning Brand exists (Req 3.7), restricts Status to Active/Inactive/Archived
 *   (Req 3.6), and stamps the audit fields createdBy/createdAt/updatedAt
 *   (Req 3.16, 23.2). When the same Product ID already exists on a *different*
 *   Brand it returns a non-blocking warning but still saves, because Product ID
 *   uniqueness is per-Brand (Req 3.3). Nama Produk never carries a uniqueness
 *   constraint (Req 3.4, 3.5).
 *
 * Like {@link BrandService} and {@link CostConfigService}, the service depends
 * only on repository ports (Dependency Inversion), so it works against the
 * in-memory adapter in tests and a database-backed adapter later without code
 * changes.
 */

import { ProductStatus } from "../domain";
import type { Product } from "../domain";
import type {
  BrandRepository,
  ProductRepository,
  PromoScenarioRepository,
} from "../persistence";
import {
  ForeignKeyError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "../persistence";
import { ValidationError } from "./errors";
import type { FailedImportRow, RawImportRow } from "./product-import";

/** Fields required to create a Product (Req 3.1). */
export interface CreateProductInput {
  /** Owning Brand surrogate id; must reference an existing Brand (Req 3.7). */
  brandId: string;
  /** Business Product ID, unique within the owning Brand (Req 3.2, 3.4). */
  productId: string;
  /** Product name; no uniqueness constraint (Req 3.4, 3.5). */
  namaProduk: string;
  kategori: string;
  /** Harga Pokok Produksi in Rupiah; non-negative. */
  hpp: number;
  /** Normal selling price in Rupiah; non-negative. */
  hargaJual: number;
  status: ProductStatus;
}

/**
 * Result of {@link ProductService.create}.
 *
 * `warning` is non-null only when the Product was still saved but the Product ID
 * is already used by another Brand (Req 3.3); it is purely informational and
 * never blocks the save.
 */
export interface CreateProductResult {
  product: Product;
  /** Per-Brand uniqueness warning (Req 3.3), or null when none applies. */
  warning: string | null;
}

/** Repository ports required by {@link ProductService}. */
export interface ProductServiceDeps {
  readonly products: ProductRepository;
  readonly brands: BrandRepository;
  /**
   * Promo_Scenario port, used to protect a Product from permanent deletion
   * while it is still referenced by any promo (Req 3.10).
   */
  readonly promos: PromoScenarioRepository;
}

/**
 * Mutable Product fields accepted by {@link ProductService.update} (Req 3.8).
 *
 * Every field is optional; only the provided fields are changed, the rest keep
 * their stored values. The owning `brandId` is intentionally absent: a
 * Product's Brand ownership is immutable (it is part of the `(brandId,
 * productId)` identity, Req 3.4).
 */
export interface UpdateProductInput {
  /** Business Product ID; remains unique within the owning Brand (Req 3.2). */
  productId?: string;
  namaProduk?: string;
  kategori?: string;
  hpp?: number;
  hargaJual?: number;
  status?: ProductStatus;
}

/**
 * Input to {@link ProductService.importProducts}: the target Brand the rows are
 * imported into (the active Brand context, Req 3.17) and the parsed file rows.
 *
 * The rows are produced by the pure parsing helpers in `./product-import`
 * (`parseProductImportContent` for CSV/TSV, or `rowsFromMatrix` for an Excel
 * sheet decoded to a matrix), keeping binary decoding out of the domain layer.
 */
export interface ImportProductsInput {
  /** Owning Brand surrogate id every imported row is attached to (Req 3.7). */
  brandId: string;
  /** Parsed data rows from the Excel/CSV file. */
  rows: readonly RawImportRow[];
}

/**
 * Outcome of {@link ProductService.importProducts}: the products created from
 * valid rows and the rows that failed, alongside the total row count.
 *
 * Invariant (design "Property 9"): `created.length + failed.length === total`,
 * and `total === rows.length`. Every valid row yields exactly one created
 * Product; every invalid row or save error yields exactly one failed entry.
 */
export interface ImportProductsResult {
  created: Product[];
  failed: FailedImportRow[];
  total: number;
}

/**
 * Criteria accepted by {@link ProductService.search} (Req 3.14, 3.15).
 *
 * Both fields are optional and combine with AND semantics:
 * - `keyword` matches a Product whose Nama Produk OR Product ID *contains* the
 *   keyword as a case-insensitive substring (Req 3.14). An empty/whitespace
 *   keyword imposes no text filter, so the call behaves as a plain listing.
 * - `brandId` restricts the result to Products owned by that Brand (Req 3.15).
 *   When omitted the listing spans every Brand (the Brand column stays visible
 *   in the UI per Req 3.17).
 */
export interface SearchProductsCriteria {
  /** Substring matched against Nama Produk or Product ID (Req 3.14). */
  keyword?: string;
  /** Optional owning-Brand filter (Req 3.15). */
  brandId?: string;
}

/** Final, trimmed Product field values fed to validation. */
interface ProductFieldValues {
  brandId: string;
  productId: string;
  namaProduk: string;
  kategori: string;
  hpp: number;
  hargaJual: number;
  status: ProductStatus;
}

/** Clear, user-facing duplicate Product ID validation failure (Req 3.2). */
function duplicateProductIdError(productId: string): ValidationError {
  return new ValidationError("Product ID duplikat dalam Brand ini.", {
    productId: `Product ID "${productId}" sudah digunakan pada Brand yang sama.`,
  });
}

/** Clear, user-facing "Product not found" validation failure. */
function productNotFoundError(id: string): ValidationError {
  return new ValidationError("Produk tidak ditemukan.", {
    id: `Produk dengan id "${id}" tidak ditemukan.`,
  });
}

/**
 * Rejection raised when a permanent delete is attempted on a Product that is
 * still referenced by a Promo_Scenario; the user is directed to Archive it
 * instead so historical promo data stays valid (Req 3.10).
 */
function referencedProductDeleteError(): ValidationError {
  return new ValidationError(
    "Produk masih direferensikan oleh Promo_Scenario sehingga tidak dapat dihapus permanen.",
    {
      status:
        "Arsipkan (Archive) produk ini alih-alih menghapus agar data promo historis tetap valid.",
    },
  );
}

/**
 * Parse a monetary cell from an import file into a number. Whitespace is
 * trimmed and thousands grouping (spaces) is removed; an empty or non-numeric
 * value yields `NaN` so the create-path validation rejects the row (Req 3.13).
 * Plain numeric values such as `50000` or `99999.99` are accepted.
 */
function parseMoney(raw: string | undefined): number {
  if (raw === undefined) {
    return NaN;
  }
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") {
    return NaN;
  }
  return Number(trimmed);
}

/**
 * Match an import file's Status cell to a {@link ProductStatus} (Active /
 * Inactive / Archived) case-insensitively. An unrecognised value is returned
 * verbatim (cast) so the create-path rejects it as an invalid status (Req 3.6).
 */
function parseStatus(raw: string | undefined): ProductStatus {
  const normalized = (raw ?? "").trim().toLowerCase();
  const match = Object.values(ProductStatus).find(
    (status) => status.toLowerCase() === normalized,
  );
  return (match ?? (raw ?? "")) as ProductStatus;
}

export class ProductService {
  constructor(private readonly deps: ProductServiceDeps) {}

  /**
   * Validate, enforce per-Brand `(brandId, productId)` uniqueness, and persist a
   * new Product with audit fields stamped (Req 3.1, 3.2, 3.4, 3.6, 3.7, 3.16,
   * 23.2).
   *
   * Behaviour:
   * - Rejects with a clear "Brand" {@link ValidationError} when no Brand is
   *   given or the Brand does not exist (Req 3.7).
   * - Rejects with a "Product ID duplikat" {@link ValidationError} when the
   *   `(brandId, productId)` combination already exists in the same Brand
   *   (Req 3.2). The repository's {@link UniqueConstraintError} is mapped to the
   *   same message as a race-condition safety net.
   * - Still saves but returns a non-null `warning` when the same Product ID is
   *   already used by another Brand (Req 3.3).
   * - Never constrains Nama Produk (Req 3.4, 3.5).
   *
   * @param input The Product fields supplied by the user.
   * @param actor Identifier of the creating user (recorded as createdBy).
   * @throws {ValidationError} when a required field is missing/invalid, the
   *   Brand is missing/non-existent, or the Product ID already exists in the
   *   same Brand.
   */
  async create(
    input: CreateProductInput,
    actor: string,
  ): Promise<CreateProductResult> {
    const values = this.normalize(input);
    this.assertValidFields(values);

    // Brand must exist before anything is saved (Req 3.7).
    const brand = await this.deps.brands.findById(values.brandId);
    if (!brand) {
      throw new ValidationError("Brand tidak valid.", {
        brandId: "Brand wajib diisi dan harus berupa Brand yang terdaftar.",
      });
    }

    // Reject a duplicate within the same Brand (Req 3.2, 3.4).
    const sameBrandDuplicate = await this.deps.products.findByRef({
      brandId: values.brandId,
      productId: values.productId,
    });
    if (sameBrandDuplicate) {
      throw duplicateProductIdError(values.productId);
    }

    // A matching Product ID on a different Brand is allowed but warned (Req 3.3).
    const sharedAcrossBrands = await this.deps.products.findByProductId(
      values.productId,
    );
    const usedByOtherBrand = sharedAcrossBrands.some(
      (p) => p.brandId !== values.brandId,
    );
    const warning = usedByOtherBrand
      ? `Product ID "${values.productId}" sudah dipakai pada Brand lain; penyimpanan tetap diizinkan karena keunikan Product ID berlaku per Brand.`
      : null;

    const now = new Date();
    const product: Product = {
      id: crypto.randomUUID(),
      brandId: values.brandId,
      productId: values.productId,
      namaProduk: values.namaProduk,
      kategori: values.kategori,
      hpp: values.hpp,
      hargaJual: values.hargaJual,
      status: values.status,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const saved = await this.deps.products.insert(product);
      return { product: saved, warning };
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw duplicateProductIdError(values.productId);
      }
      if (error instanceof ForeignKeyError) {
        throw new ValidationError("Brand tidak valid.", {
          brandId: "Brand wajib diisi dan harus berupa Brand yang terdaftar.",
        });
      }
      throw error;
    }
  }

  /**
   * Trim string fields so leading/trailing whitespace never satisfies a
   * required-field check or sneaks into the `(brandId, productId)` uniqueness
   * key.
   */
  private normalize(input: CreateProductInput): ProductFieldValues {
    return {
      brandId: typeof input.brandId === "string" ? input.brandId.trim() : "",
      productId:
        typeof input.productId === "string" ? input.productId.trim() : "",
      namaProduk:
        typeof input.namaProduk === "string" ? input.namaProduk.trim() : "",
      kategori: typeof input.kategori === "string" ? input.kategori.trim() : "",
      hpp: input.hpp,
      hargaJual: input.hargaJual,
      status: input.status,
    };
  }

  /**
   * Apply edited fields to an existing Product and persist them, re-stamping
   * `updatedAt` (Req 3.8, 3.16). Only the fields present in `input` change; the
   * rest keep their stored values. The owning Brand is immutable.
   *
   * Behaviour:
   * - Rejects with a "Produk tidak ditemukan" {@link ValidationError} when no
   *   Product has the given surrogate id.
   * - Re-validates the resulting field values exactly like {@link create}, so
   *   an invalid edit is rejected before any mutation and the stored Product is
   *   left untouched (Req 23.3, 23.4).
   * - Keeps `(brandId, productId)` uniqueness within the Brand (Req 3.2); the
   *   repository's {@link UniqueConstraintError} is mapped as a race-condition
   *   safety net.
   * - `createdBy`/`createdAt` are preserved; `updatedAt` is refreshed (Req 3.16).
   *
   * @throws {ValidationError} when the Product is missing, a field is invalid,
   *   or the new Product ID collides within the same Brand.
   */
  async update(
    id: string,
    input: UpdateProductInput,
    _actor: string,
  ): Promise<Product> {
    const existing = await this.deps.products.findById(id);
    if (!existing) {
      throw productNotFoundError(id);
    }

    // Merge edits over the stored values (brandId stays immutable, Req 3.4).
    const merged = this.normalize({
      brandId: existing.brandId,
      productId: input.productId ?? existing.productId,
      namaProduk: input.namaProduk ?? existing.namaProduk,
      kategori: input.kategori ?? existing.kategori,
      hpp: input.hpp ?? existing.hpp,
      hargaJual: input.hargaJual ?? existing.hargaJual,
      status: input.status ?? existing.status,
    });
    this.assertValidFields(merged);

    // Reject a duplicate (brandId, productId) on a *different* Product (Req 3.2).
    if (merged.productId !== existing.productId) {
      const clash = await this.deps.products.findByRef({
        brandId: merged.brandId,
        productId: merged.productId,
      });
      if (clash && clash.id !== existing.id) {
        throw duplicateProductIdError(merged.productId);
      }
    }

    const updated: Product = {
      ...existing,
      productId: merged.productId,
      namaProduk: merged.namaProduk,
      kategori: merged.kategori,
      hpp: merged.hpp,
      hargaJual: merged.hargaJual,
      status: merged.status,
      updatedAt: new Date(),
    };

    try {
      return await this.deps.products.update(updated);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw duplicateProductIdError(merged.productId);
      }
      throw error;
    }
  }

  /**
   * Mark a Product as Archived without deleting its data (Req 3.11). Archiving
   * hides the Product from normal selection while keeping it available for
   * historical promo data and reporting. `updatedAt` is refreshed (Req 3.16);
   * archiving an already-Archived Product is idempotent.
   *
   * @throws {ValidationError} when no Product has the given surrogate id.
   */
  async archive(id: string, _actor: string): Promise<Product> {
    const existing = await this.deps.products.findById(id);
    if (!existing) {
      throw productNotFoundError(id);
    }
    const archived: Product = {
      ...existing,
      status: ProductStatus.Archived,
      updatedAt: new Date(),
    };
    return this.deps.products.update(archived);
  }

  /**
   * Permanently delete a Product, but only when it is NOT referenced by any
   * Promo_Scenario (Req 3.9). When the Product is referenced by one or more
   * promos the permanent delete is rejected and the caller is directed to
   * Archive it instead, so historical promo data stays valid (Req 3.10).
   *
   * Reference is tested by the `(brandId, productId)` identity, never by the
   * product name (Req 3.4). The repository's {@link ReferentialIntegrityError}
   * is mapped to the same rejection as a race-condition safety net.
   *
   * @throws {ValidationError} when the Product is missing, or when it is still
   *   referenced by a promo (with guidance to Archive instead).
   */
  async delete(id: string, _actor: string): Promise<void> {
    const existing = await this.deps.products.findById(id);
    if (!existing) {
      throw productNotFoundError(id);
    }

    const referenced = await this.deps.promos.existsByProductRef({
      brandId: existing.brandId,
      productId: existing.productId,
    });
    if (referenced) {
      throw referencedProductDeleteError();
    }

    try {
      await this.deps.products.delete(id);
    } catch (error) {
      if (error instanceof ReferentialIntegrityError) {
        throw referencedProductDeleteError();
      }
      throw error;
    }
  }

  /**
   * Import a batch of parsed Excel/CSV rows into the given Brand, partitioning
   * them into successfully created Products and failed rows (Req 3.12, 3.13).
   *
   * Each row is mapped to a {@link CreateProductInput} and created through the
   * exact same validation and uniqueness path as a single {@link create}, so an
   * imported Product is indistinguishable from a manually-added one. Rows are
   * processed independently and sequentially:
   * - A row that creates a Product is added to `created` (one entry per valid
   *   row, Req 3.12). A non-blocking cross-Brand warning never fails the row.
   * - A row rejected by validation (missing/invalid field, duplicate Product ID
   *   in the Brand, missing Brand) is added to `failed` with the validation
   *   message and per-field details (Req 3.13).
   * - A row that triggers an unexpected system error while saving is likewise
   *   added to `failed` (Req 3.13), never aborting the rest of the import.
   *
   * Guarantees the partition invariant `created.length + failed.length ===
   * total` with `total === rows.length` (design "Property 9").
   *
   * @param input The target Brand id and the parsed file rows.
   * @param actor Identifier of the importing user (recorded as createdBy).
   */
  async importProducts(
    input: ImportProductsInput,
    actor: string,
  ): Promise<ImportProductsResult> {
    const created: Product[] = [];
    const failed: FailedImportRow[] = [];

    for (const row of input.rows) {
      const candidate = this.toCreateInput(input.brandId, row);
      try {
        const { product } = await this.create(candidate, actor);
        created.push(product);
      } catch (error) {
        if (error instanceof ValidationError) {
          failed.push({
            row: row.rowNumber,
            reason: error.message,
            fields: error.fields,
          });
        } else {
          // A system error must not abort the batch; report the row (Req 3.13).
          failed.push({
            row: row.rowNumber,
            reason:
              "Terjadi error sistem saat menyimpan baris ini sehingga baris gagal diimpor.",
          });
        }
      }
    }

    return { created, failed, total: input.rows.length };
  }

  /**
   * List the Product_Master, optionally narrowed by a substring keyword and/or
   * an owning-Brand filter (Req 3.14, 3.15; design "Property 10").
   *
   * Matching semantics (both criteria combine with AND):
   * - `keyword` is matched as a case-insensitive substring against EITHER the
   *   Nama Produk OR the Product ID; a Product is included when either field
   *   contains the keyword (Req 3.14). Leading/trailing whitespace on the
   *   keyword is ignored, and an empty/whitespace-only keyword imposes no text
   *   filter so the call behaves as a plain listing.
   * - `brandId` restricts the result to Products owned by that Brand (Req 3.15).
   *   When omitted (or empty) the listing spans every Brand, keeping the Brand
   *   column meaningful across the whole catalogue (Req 3.17).
   *
   * The Brand scoping is pushed down to the repository `list` filter; the
   * substring match is applied in-memory so the same semantics hold against any
   * adapter.
   *
   * @param criteria Optional keyword and/or owning-Brand filter.
   * @returns The matching Products (every Product when no criteria are given).
   */
  async search(criteria: SearchProductsCriteria = {}): Promise<Product[]> {
    const brandId =
      typeof criteria.brandId === "string" && criteria.brandId.trim() !== ""
        ? criteria.brandId.trim()
        : undefined;
    const keyword =
      typeof criteria.keyword === "string" ? criteria.keyword.trim() : "";

    const candidates = await this.deps.products.list(
      brandId ? { brandId } : undefined,
    );

    if (keyword === "") {
      return candidates;
    }

    const needle = keyword.toLowerCase();
    return candidates.filter(
      (product) =>
        product.namaProduk.toLowerCase().includes(needle) ||
        product.productId.toLowerCase().includes(needle),
    );
  }

  /**
   * Map a raw import row's string cells onto a {@link CreateProductInput} for
   * the given Brand. Monetary cells are parsed leniently to numbers (an empty
   * or non-numeric cell becomes `NaN`, which `create` rejects), and Status is
   * matched case-insensitively to a {@link ProductStatus}; an unknown status is
   * passed through verbatim so `create` reports it as invalid (Req 3.6, 3.13).
   */
  private toCreateInput(
    brandId: string,
    row: RawImportRow,
  ): CreateProductInput {
    const v = row.values;
    return {
      brandId,
      productId: v.productId ?? "",
      namaProduk: v.namaProduk ?? "",
      kategori: v.kategori ?? "",
      hpp: parseMoney(v.hpp),
      hargaJual: parseMoney(v.hargaJual),
      status: parseStatus(v.status),
    };
  }

  /**
   * Reject the operation when any required field is empty, a monetary field is
   * not a finite non-negative number, or the Status is not a valid
   * {@link ProductStatus} (Req 3.6). Throws before any mutation so stored data
   * is left untouched. Nama Produk is required but carries no uniqueness
   * constraint (Req 3.4).
   */
  private assertValidFields(values: ProductFieldValues): void {
    const fields: Record<string, string> = {};
    if (values.brandId === "") {
      fields.brandId = "Brand wajib diisi.";
    }
    if (values.productId === "") {
      fields.productId = "Product ID wajib diisi.";
    }
    if (values.namaProduk === "") {
      fields.namaProduk = "Nama Produk wajib diisi.";
    }
    if (values.kategori === "") {
      fields.kategori = "Kategori wajib diisi.";
    }
    if (!Number.isFinite(values.hpp) || values.hpp < 0) {
      fields.hpp = "HPP harus berupa angka tidak negatif.";
    }
    if (!Number.isFinite(values.hargaJual) || values.hargaJual < 0) {
      fields.hargaJual = "Harga Jual harus berupa angka tidak negatif.";
    }
    if (!Object.values(ProductStatus).includes(values.status)) {
      fields.status = "Status harus berupa Active, Inactive, atau Archived.";
    }
    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Data Produk tidak valid.", fields);
    }
  }
}
