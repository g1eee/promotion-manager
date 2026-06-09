/**
 * BrandService — Brand Management, the root of the data-ownership hierarchy
 * (Req 19, Req 23).
 *
 * Responsibilities (design "Components and Interfaces → Brand Management"):
 * - `create` validates the required Brand fields, enforces global Brand ID
 *   uniqueness (Req 19.1, 19.2), and stamps the audit fields createdBy/createdAt
 *   /updatedAt (Req 23.2).
 * - `update` persists changes ONLY when every validation/constraint passes; on
 *   violation it rejects and the previously stored data is preserved
 *   (Req 19.3, 19.4, 23.3). createdBy/createdAt stay immutable (Req 23.4).
 * - `delete` removes a Brand only when it owns no Product/Campaign/Promo; when
 *   related data exists the repository raises a referential-integrity failure
 *   which is surfaced with a clear "masih memiliki data terkait" message
 *   (Req 19.5, 19.6).
 * - `archive` marks the Brand archived without deleting its data (Req 19.7).
 *
 * The "exactly one Brand per Product/Campaign/Promo_Scenario" invariant
 * (Req 19.8) is enforced by the persistence layer's foreign-key constraints
 * (each owns a single `brandId`); this service relies on those constraints
 * rather than re-implementing them. Many Brands are supported (Req 19.9).
 *
 * Like {@link CostConfigService}, the service depends only on repository ports
 * (Dependency Inversion), so it works against the in-memory adapter in tests and
 * a database-backed adapter later without code changes.
 */

import { BrandStatus } from "../domain";
import type { Brand } from "../domain";
import type { BrandRepository } from "../persistence";
import {
  NotFoundError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "../persistence";
import { ValidationError } from "./errors";

/** Fields required to create a Brand (Req 19.1). */
export interface CreateBrandInput {
  /** Business Brand ID, unique globally (Req 19.2). */
  brandId: string;
  brandName: string;
  displayName: string;
  status: BrandStatus;
}

/** Mutable Brand fields; only provided keys are changed (Req 19.3). */
export interface UpdateBrandChanges {
  brandId?: string;
  brandName?: string;
  displayName?: string;
  status?: BrandStatus;
}

/** Repository ports required by {@link BrandService}. */
export interface BrandServiceDeps {
  readonly brands: BrandRepository;
}

/** Final, trimmed Brand field values fed to validation. */
interface BrandFieldValues {
  brandId: string;
  brandName: string;
  displayName: string;
  status: BrandStatus;
}

/** Clear, user-facing duplicate Brand ID validation failure (Req 19.2). */
function duplicateBrandIdError(brandId: string): ValidationError {
  return new ValidationError("Brand ID duplikat.", {
    brandId: `Brand ID "${brandId}" sudah digunakan oleh Brand lain.`,
  });
}

export class BrandService {
  constructor(private readonly deps: BrandServiceDeps) {}

  /**
   * List all Brands (newest configuration screens render the full set; many
   * Brands are supported, Req 19.9). An optional status filter narrows the
   * result to Active or Archived Brands.
   */
  async list(filter?: { status?: BrandStatus }): Promise<Brand[]> {
    return this.deps.brands.list(filter);
  }

  /**
   * Validate, enforce Brand ID uniqueness, and persist a new Brand with audit
   * fields stamped (Req 19.1, 19.2, 23.2).
   *
   * Uniqueness is checked up-front so a duplicate surfaces as a clear
   * "Brand ID duplikat" {@link ValidationError}; the repository's
   * {@link UniqueConstraintError} is also mapped to the same message as a
   * safety net against races.
   *
   * @param input The Brand fields supplied by the user.
   * @param actor Identifier of the creating user (recorded as createdBy).
   * @throws {ValidationError} when a required field is missing/invalid, or the
   *   Brand ID already exists.
   */
  async create(input: CreateBrandInput, actor: string): Promise<Brand> {
    const values = this.normalize(input);
    this.assertValidFields(values);

    const existing = await this.deps.brands.findByBrandId(values.brandId);
    if (existing) {
      throw duplicateBrandIdError(values.brandId);
    }

    const now = new Date();
    const brand: Brand = {
      id: crypto.randomUUID(),
      brandId: values.brandId,
      brandName: values.brandName,
      displayName: values.displayName,
      status: values.status,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    try {
      return await this.deps.brands.insert(brand);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw duplicateBrandIdError(values.brandId);
      }
      throw error;
    }
  }

  /**
   * Persist Brand field changes only when every validation and constraint
   * passes (Req 19.3). On violation the update is rejected and the previously
   * stored Brand is preserved (Req 19.4). `updatedAt` is refreshed while
   * createdBy/createdAt remain immutable (Req 23.3, 23.4).
   *
   * @throws {NotFoundError} when no Brand has the given surrogate id.
   * @throws {ValidationError} when a field is invalid or the new Brand ID
   *   duplicates another Brand.
   */
  async update(id: string, changes: UpdateBrandChanges): Promise<Brand> {
    const existing = await this.deps.brands.findById(id);
    if (!existing) {
      throw new NotFoundError("Brand", id);
    }

    const values = this.normalize({
      brandId: changes.brandId ?? existing.brandId,
      brandName: changes.brandName ?? existing.brandName,
      displayName: changes.displayName ?? existing.displayName,
      status: changes.status ?? existing.status,
    });
    this.assertValidFields(values);

    // createdBy/createdAt are carried over unchanged (immutable, Req 23.4);
    // only the mutable fields and updatedAt move forward.
    const updated: Brand = {
      ...existing,
      brandId: values.brandId,
      brandName: values.brandName,
      displayName: values.displayName,
      status: values.status,
      updatedAt: new Date(),
    };

    try {
      return await this.deps.brands.update(updated);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw duplicateBrandIdError(values.brandId);
      }
      throw error;
    }
  }

  /**
   * Mark a Brand as archived without deleting its data (Req 19.7). Refreshes
   * `updatedAt`; createdBy/createdAt remain immutable.
   *
   * @throws {NotFoundError} when no Brand has the given surrogate id.
   */
  async archive(id: string): Promise<Brand> {
    const existing = await this.deps.brands.findById(id);
    if (!existing) {
      throw new NotFoundError("Brand", id);
    }
    const archived: Brand = {
      ...existing,
      status: BrandStatus.Archived,
      updatedAt: new Date(),
    };
    return this.deps.brands.update(archived);
  }

  /**
   * Delete a Brand that owns no related data (Req 19.5). When the Brand still
   * owns a Product, Campaign, or Promo_Scenario the repository raises a
   * {@link ReferentialIntegrityError}; it is re-surfaced with a clear
   * "masih memiliki data terkait" message that guides the user toward Archive
   * (Req 19.6).
   *
   * @throws {ReferentialIntegrityError} when related data still references the
   *   Brand.
   * @throws {NotFoundError} when no Brand has the given surrogate id.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.deps.brands.delete(id);
    } catch (error) {
      if (error instanceof ReferentialIntegrityError) {
        throw new ReferentialIntegrityError(
          "Brand",
          "Brand masih memiliki data terkait (Product, Campaign, atau Promo_Scenario); arsipkan Brand sebagai gantinya",
        );
      }
      throw error;
    }
  }

  /** Trim string fields so leading/trailing whitespace never satisfies a
   * required-field check or sneaks into the stored Brand ID uniqueness key. */
  private normalize(input: CreateBrandInput): BrandFieldValues {
    return {
      brandId: typeof input.brandId === "string" ? input.brandId.trim() : "",
      brandName:
        typeof input.brandName === "string" ? input.brandName.trim() : "",
      displayName:
        typeof input.displayName === "string" ? input.displayName.trim() : "",
      status: input.status,
    };
  }

  /**
   * Reject the operation when any required field is empty or the Status is not
   * a valid {@link BrandStatus}. Throws before any mutation so stored data is
   * left untouched (Req 19.4).
   */
  private assertValidFields(values: BrandFieldValues): void {
    const fields: Record<string, string> = {};
    if (values.brandId === "") {
      fields.brandId = "Brand ID wajib diisi.";
    }
    if (values.brandName === "") {
      fields.brandName = "Brand Name wajib diisi.";
    }
    if (values.displayName === "") {
      fields.displayName = "Display Name wajib diisi.";
    }
    if (!Object.values(BrandStatus).includes(values.status)) {
      fields.status = "Status harus berupa Active atau Archived.";
    }
    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Data Brand tidak valid.", fields);
    }
  }
}
