/**
 * ProductSelection — pure domain logic for choosing Product_Master products
 * into a Promo_Scenario (Req 9).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no UI concerns. Every
 * operation works on immutable snapshots (the promo's current `ProductRef[]`
 * and a catalogue of `Product` records pulled from Product_Master) and returns
 * a *new* value rather than mutating its inputs, keeping the behaviour trivially
 * unit- and property-testable.
 *
 * Identity is always the per-Brand `(brandId, productId)` pair — the product
 * name is never used as a relation key (Req 9.10, Property 22). A product's
 * display fields (Product ID, Nama Produk, HPP, Harga Jual) are *pulled* from
 * the matching Product_Master record (Req 9.1, Property 22).
 *
 * Covered acceptance criteria:
 * - Req 9.1: pull Product ID, Nama Produk, HPP, and Harga Jual from
 *   Product_Master for a selected product.
 * - Req 9.2: allow adding many products to one promo.
 * - Req 9.3: reject adding a product already on the promo, keeping the list.
 * - Req 9.4: remove a product from the promo's product list.
 * - Req 9.6/9.8/9.9: bulk paste of Product IDs partitions into added /
 *   skipped-other-brand / unmatched, never aborting, and silently skips
 *   duplicates already on the promo.
 * - Req 9.7: support multi-select (adding many products in one action).
 * - Req 9.10: reference selected products by `(brandId, productId)`, never by
 *   product name.
 * - Req 9.11/9.13: the selectable list for a *new* promo contains only Active
 *   products owned by the promo's Brand.
 * - Req 9.12: reject adding a product owned by a different Brand.
 * - Req 9.14: existing references to Inactive/Archived products are preserved
 *   as valid historical references and never silently dropped.
 *
 * Validation here is intentionally kept in the domain layer (rather than
 * importing the service-layer `ValidationError`) so the domain does not depend
 * on the service layer. Invalid single-add input raises a
 * {@link ProductSelectionError}, which the service/API layers may translate
 * into their own response shape.
 */

import { ProductStatus } from "./enums";
import type { Product, ProductRef } from "./types";

/**
 * Deterministic, domain-level validation failure raised by
 * {@link ProductSelection} single-add operations when a product violates an
 * acceptance criterion (different Brand, not Active, or already selected).
 *
 * Kept distinct from the service-layer `ValidationError` so the domain remains
 * dependency-free; callers in the service layer may catch and re-map it.
 */
export class ProductSelectionError extends Error {
  /** Optional per-field messages, e.g. `{ brandId: "..." }`. */
  readonly fields: Readonly<Record<string, string>>;

  constructor(message: string, fields: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = "ProductSelectionError";
    this.fields = fields;
  }
}

/**
 * Display projection of a selected product, with the fields pulled from the
 * matching Product_Master record (Req 9.1, Property 22). The reference identity
 * is `(brandId, productId)`; the product name is carried for display only and
 * is never a relation key (Req 9.10).
 */
export interface ProductSelectionItem {
  readonly brandId: string;
  readonly productId: string;
  /** Nama Produk pulled from Product_Master (display only). */
  readonly namaProduk: string;
  /** Harga Pokok Produksi (Rupiah) pulled from Product_Master. */
  readonly hpp: number;
  /** Normal selling price (Rupiah) pulled from Product_Master. */
  readonly hargaJual: number;
}

/**
 * Outcome of {@link ProductSelection.bulkAddByProductIds}: the new reference
 * list plus the partition of the pasted Product IDs (Req 9.6, 9.8, 9.9;
 * Property 23). Every input Product ID lands in exactly one of `added`,
 * `skippedDuplicate`, `skippedOtherBrand`, or `unmatched`.
 */
export interface BulkAddResult {
  /** The promo's product references after the operation. */
  readonly refs: ProductRef[];
  /** Product IDs added (matched an Active product in the promo's Brand). */
  readonly added: string[];
  /** Product IDs already on the promo, skipped without error (Req 9.9). */
  readonly skippedDuplicate: string[];
  /** Product IDs that only matched products on a *different* Brand (Req 9.6). */
  readonly skippedOtherBrand: string[];
  /** Product IDs that matched no selectable product in the promo's Brand (Req 9.8). */
  readonly unmatched: string[];
}

/** True when `product` is owned by `brandId` and has Active status (Req 9.11, 9.13). */
function isSelectable(product: Product, brandId: string): boolean {
  return product.brandId === brandId && product.status === ProductStatus.Active;
}

/** True when `ref` already exists in `refs` by `(brandId, productId)` identity. */
function containsRef(refs: readonly ProductRef[], ref: ProductRef): boolean {
  return refs.some(
    (r) => r.brandId === ref.brandId && r.productId === ref.productId,
  );
}

/** Project a Product_Master record to its selection display item (Req 9.1). */
function toSelectionItem(product: Product): ProductSelectionItem {
  return {
    brandId: product.brandId,
    productId: product.productId,
    namaProduk: product.namaProduk,
    hpp: product.hpp,
    hargaJual: product.hargaJual,
  };
}

/**
 * The products that may be selected for a *new* Promo_Scenario owned by
 * `promoBrandId`: only Active products owned by that Brand (Req 9.11, 9.13).
 * Products from other Brands and Inactive/Archived products are excluded.
 *
 * The input list is not mutated; the returned list preserves input order.
 */
function selectableProducts(
  products: readonly Product[],
  promoBrandId: string,
): Product[] {
  return products.filter((product) => isSelectable(product, promoBrandId));
}

/**
 * Add a single product to the promo's reference list (Req 9.1, 9.2, 9.3, 9.10,
 * 9.12, 9.13), returning a new `ProductRef[]`.
 *
 * Rejections (the current list is preserved, nothing is added):
 * - The product is owned by a different Brand than the promo (Req 9.12).
 * - The product is not Active, so it cannot be selected for a new promo
 *   (Req 9.13). Existing historical references are unaffected (Req 9.14).
 * - The product is already on the promo (Req 9.3).
 *
 * The reference is stored as `(brandId, productId)` — never the name (Req 9.10).
 *
 * @throws {ProductSelectionError} on any of the rejections above.
 */
function addProduct(
  refs: readonly ProductRef[],
  product: Product,
  promoBrandId: string,
): ProductRef[] {
  if (product.brandId !== promoBrandId) {
    throw new ProductSelectionError(
      "Produk harus berasal dari Brand yang sama dengan promo.",
      {
        brandId:
          "Produk dari Brand lain tidak dapat ditambahkan ke promo ini.",
      },
    );
  }
  if (product.status !== ProductStatus.Active) {
    throw new ProductSelectionError(
      "Hanya produk berstatus Active yang dapat dipilih untuk promo baru.",
      {
        status:
          "Produk Inactive atau Archived tidak dapat dipilih pada promo baru.",
      },
    );
  }

  const ref: ProductRef = {
    brandId: product.brandId,
    productId: product.productId,
  };
  if (containsRef(refs, ref)) {
    throw new ProductSelectionError(
      "Produk sudah ada dalam promo ini.",
      {
        productId: `Product ID "${product.productId}" sudah dipilih pada promo ini.`,
      },
    );
  }

  return [...refs, ref];
}

/**
 * Add many products at once (multi-select, Req 9.7), returning a new
 * `ProductRef[]`. Every product must be Active and owned by the promo's Brand
 * (Req 9.12, 9.13); products already on the promo are silently skipped so the
 * action does not fail when the selection overlaps the current list (Req 9.3).
 *
 * The operation is all-or-nothing on *validity*: if any product belongs to a
 * different Brand or is not Active it is rejected before any change is made, so
 * the promo's list is never left partially updated by an invalid multi-select.
 *
 * @throws {ProductSelectionError} when any product is from a different Brand
 *   (Req 9.12) or is not Active (Req 9.13).
 */
function addProducts(
  refs: readonly ProductRef[],
  products: readonly Product[],
  promoBrandId: string,
): ProductRef[] {
  // Validate every product up-front so an invalid item never partially mutates.
  for (const product of products) {
    if (product.brandId !== promoBrandId) {
      throw new ProductSelectionError(
        "Produk harus berasal dari Brand yang sama dengan promo.",
        {
          brandId:
            "Produk dari Brand lain tidak dapat ditambahkan ke promo ini.",
        },
      );
    }
    if (product.status !== ProductStatus.Active) {
      throw new ProductSelectionError(
        "Hanya produk berstatus Active yang dapat dipilih untuk promo baru.",
        {
          status:
            "Produk Inactive atau Archived tidak dapat dipilih pada promo baru.",
        },
      );
    }
  }

  const result: ProductRef[] = [...refs];
  for (const product of products) {
    const ref: ProductRef = {
      brandId: product.brandId,
      productId: product.productId,
    };
    if (!containsRef(result, ref)) {
      result.push(ref);
    }
  }
  return result;
}

/**
 * Remove a product from the promo's reference list by `(brandId, productId)`
 * identity (Req 9.4), returning a new `ProductRef[]`. Removing a reference that
 * is not present is a no-op that returns a copy of the original list.
 */
function removeProduct(
  refs: readonly ProductRef[],
  ref: ProductRef,
): ProductRef[] {
  return refs.filter(
    (r) => !(r.brandId === ref.brandId && r.productId === ref.productId),
  );
}

/**
 * Bulk-add pasted Product IDs to the promo, partitioning them and never
 * aborting the whole operation (Req 9.6, 9.8, 9.9; Property 23).
 *
 * Each *distinct* pasted Product ID is classified into exactly one bucket,
 * evaluated against the full multi-brand catalogue:
 * - `added`: an Active product owned by the promo's Brand matches the ID and it
 *   is not already on the promo (Req 9.6).
 * - `skippedDuplicate`: an Active product owned by the promo's Brand matches but
 *   the reference is already on the promo; skipped without error (Req 9.9).
 * - `skippedOtherBrand`: no selectable (Active, same-Brand) product matches, but
 *   the ID matches a product on a different Brand; skipped (Req 9.6).
 * - `unmatched`: the ID matches no selectable product in the promo's Brand and
 *   no product on any other Brand either (Req 9.8). Inactive/Archived products
 *   in the promo's Brand are not selectable for a new promo (Req 9.13), so an ID
 *   matching only those — with no other-Brand match — is reported as unmatched.
 *
 * Duplicate IDs within the pasted input are de-duplicated (first occurrence
 * wins), preserving input order. Whitespace-only IDs are ignored. The input
 * `refs` are not mutated.
 *
 * @param refs The promo's current product references (not mutated).
 * @param productIds The pasted Product IDs (any order; may contain duplicates).
 * @param products The full Product_Master catalogue to match against.
 * @param promoBrandId The promo's owning Brand id.
 */
function bulkAddByProductIds(
  refs: readonly ProductRef[],
  productIds: readonly string[],
  products: readonly Product[],
  promoBrandId: string,
): BulkAddResult {
  const resultRefs: ProductRef[] = [...refs];
  const added: string[] = [];
  const skippedDuplicate: string[] = [];
  const skippedOtherBrand: string[] = [];
  const unmatched: string[] = [];

  const seen = new Set<string>();

  for (const raw of productIds) {
    const productId = typeof raw === "string" ? raw.trim() : "";
    if (productId === "" || seen.has(productId)) {
      continue;
    }
    seen.add(productId);

    const matches = products.filter((p) => p.productId === productId);
    const selectable = matches.find((p) => isSelectable(p, promoBrandId));

    if (selectable) {
      const ref: ProductRef = {
        brandId: selectable.brandId,
        productId: selectable.productId,
      };
      if (containsRef(resultRefs, ref)) {
        skippedDuplicate.push(productId);
      } else {
        resultRefs.push(ref);
        added.push(productId);
      }
      continue;
    }

    const matchesOtherBrand = matches.some((p) => p.brandId !== promoBrandId);
    if (matchesOtherBrand) {
      skippedOtherBrand.push(productId);
    } else {
      unmatched.push(productId);
    }
  }

  return {
    refs: resultRefs,
    added,
    skippedDuplicate,
    skippedOtherBrand,
    unmatched,
  };
}

/**
 * Resolve the promo's stored references to their Product_Master display items
 * (Req 9.1, 9.14, Property 22), pulling Product ID, Nama Produk, HPP, and Harga
 * Jual from the catalogue via `(brandId, productId)` identity.
 *
 * References are resolved regardless of the matched product's status, so an
 * existing reference to an Inactive/Archived product is preserved as a valid
 * historical reference and still rendered (Req 9.14). A reference with no
 * matching catalogue record is omitted (it cannot be projected without a
 * source record), never throwing.
 *
 * The result preserves the order of `refs`.
 */
function resolveSelectedItems(
  refs: readonly ProductRef[],
  products: readonly Product[],
): ProductSelectionItem[] {
  const items: ProductSelectionItem[] = [];
  for (const ref of refs) {
    const product = products.find(
      (p) => p.brandId === ref.brandId && p.productId === ref.productId,
    );
    if (product) {
      items.push(toSelectionItem(product));
    }
  }
  return items;
}

/**
 * Pure Product Selection operations over a promo's `ProductRef[]` and the
 * Product_Master catalogue (Req 9, Properties 22–24).
 */
export const ProductSelection = {
  /** Active, same-Brand products selectable for a new promo (Req 9.11, 9.13). */
  selectableProducts,
  /** Add a single product, rejecting other-Brand/Inactive/duplicate (Req 9.1–9.3, 9.12, 9.13). */
  addProduct,
  /** Add many products at once, skipping duplicates (multi-select, Req 9.7). */
  addProducts,
  /** Remove a product reference by identity (Req 9.4). */
  removeProduct,
  /** Bulk paste Product IDs, partitioning added/skipped/unmatched (Req 9.6, 9.8, 9.9). */
  bulkAddByProductIds,
  /** Resolve references to Product_Master display items, preserving history (Req 9.1, 9.14). */
  resolveSelectedItems,
  /** Project a single Product_Master record to its display item (Req 9.1). */
  toSelectionItem,
} as const;
