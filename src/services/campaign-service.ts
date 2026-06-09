/**
 * CampaignService — Campaign Management, the container that holds one or more
 * Promo_Scenario, owned per Brand (Req 6, Req 23).
 *
 * Responsibilities (design "Components and Interfaces → Campaign Management"):
 * - `create` validates the required Campaign fields, enforces that Tanggal
 *   Selesai is on or after Tanggal Mulai (Req 6.2), requires an existing Brand
 *   (Req 6.3), stores the Campaign with the initial Status Draft tied to exactly
 *   one Brand (Req 6.1, 6.4), and stamps the audit fields createdBy/createdAt/
 *   updatedAt (Req 6.13, 23.2).
 * - `update` applies the same validation as create and persists changes ONLY
 *   when every validation passes; on violation it blocks the save and the
 *   previously stored data is preserved (Req 6.5, 6.6). `updatedAt` is refreshed
 *   while createdBy/createdAt stay immutable (Req 6.13, 23.3).
 * - `archive` marks the Campaign with Status Archived without deleting its data
 *   (Req 6.9).
 * - `delete` removes a Campaign only when it has no related Promo_Scenario
 *   (Req 6.7); when related promos exist the repository raises a
 *   referential-integrity failure which is surfaced with a clear message that
 *   the Campaign must be archived instead so its history stays available
 *   (Req 6.8).
 *
 * System errors (e.g. a database-connectivity failure) are deliberately NOT
 * wrapped as {@link ValidationError}: only deterministic input-validation
 * failures raise {@link ValidationError}, so the API layer can distinguish a
 * system error (500) from an input-validation rejection (Req 6.14).
 *
 * Like the sibling services, this service depends only on repository ports
 * (Dependency Inversion), so it works against the in-memory adapter in tests and
 * a database-backed adapter later without code changes.
 */

import { CampaignStatus } from "../domain";
import type { Campaign } from "../domain";
import type { BrandRepository, CampaignRepository } from "../persistence";
import {
  ForeignKeyError,
  NotFoundError,
  ReferentialIntegrityError,
} from "../persistence";
import { ValidationError } from "./errors";

/** Fields required to create a Campaign (Req 6.1). */
export interface CreateCampaignInput {
  /** Owning Brand surrogate id; must reference an existing Brand (Req 6.3). */
  brandId: string;
  /** Campaign name (Nama Campaign). */
  nama: string;
  tanggalMulai: Date;
  /** Must be on or after `tanggalMulai` (Req 6.2). */
  tanggalSelesai: Date;
}

/**
 * Fields required to create a Campaign inline, in the middle of the Promo
 * creation flow (Req 7.12). `brandId` is optional: when omitted it defaults to
 * the owning promo's Brand (Brand ter-default = Brand promo). When supplied it
 * must equal the promo's Brand or the save is rejected (Req 7.14).
 */
export interface CreateInlineCampaignInput {
  /** Optional owning Brand; defaults to the promo's Brand when omitted. */
  brandId?: string;
  /** Campaign name (Nama Campaign). */
  nama: string;
  tanggalMulai: Date;
  /** Must be on or after `tanggalMulai` (Req 6.2 via Req 7.13). */
  tanggalSelesai: Date;
}

/** Mutable Campaign fields; only provided keys are changed (Req 6.5). */
export interface UpdateCampaignChanges {
  brandId?: string;
  nama?: string;
  tanggalMulai?: Date;
  tanggalSelesai?: Date;
  status?: CampaignStatus;
}

/** Repository ports required by {@link CampaignService}. */
export interface CampaignServiceDeps {
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
}

/** Final, trimmed/normalized Campaign field values fed to validation. */
interface CampaignFieldValues {
  brandId: string;
  nama: string;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  status: CampaignStatus;
}

/** Clear, user-facing invalid/missing Brand validation failure (Req 6.3). */
function invalidBrandError(): ValidationError {
  return new ValidationError("Brand tidak valid.", {
    brandId: "Brand wajib diisi dan harus berupa Brand yang terdaftar.",
  });
}

/**
 * Clear, user-facing failure raised when an inline Campaign is given a Brand
 * that differs from the Brand of the Promo_Scenario being created (Req 7.14).
 */
function brandMismatchError(): ValidationError {
  return new ValidationError(
    "Brand campaign harus sama dengan Brand promo.",
    {
      brandId: "Brand campaign harus sama dengan Brand promo yang sedang dibuat.",
    },
  );
}

/** Whether a value is a usable (non-NaN) Date instance. */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export class CampaignService {
  constructor(private readonly deps: CampaignServiceDeps) {}

  /** List Campaigns, optionally narrowed to a single owning Brand. */
  async list(filter?: { brandId?: string }): Promise<Campaign[]> {
    return this.deps.campaigns.list(filter);
  }

  /**
   * Validate and persist a new Campaign with the initial Status Draft, tied to
   * exactly one existing Brand, and audit fields stamped (Req 6.1, 6.2, 6.3,
   * 6.4, 6.13, 23.2).
   *
   * @param input The Campaign fields supplied by the user.
   * @param actor Identifier of the creating user (recorded as createdBy).
   * @throws {ValidationError} when a required field is missing/invalid, the date
   *   range is inverted, or the Brand is missing/non-existent.
   */
  async create(input: CreateCampaignInput, actor: string): Promise<Campaign> {
    // New Campaigns always begin as Draft (Req 6.1); status is not user input.
    const values = this.normalize({ ...input, status: CampaignStatus.Draft });
    this.assertValidFields(values);

    // Brand must exist before anything is saved (Req 6.3).
    const brand = await this.deps.brands.findById(values.brandId);
    if (!brand) {
      throw invalidBrandError();
    }

    const now = new Date();
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      brandId: values.brandId,
      nama: values.nama,
      tanggalMulai: values.tanggalMulai,
      tanggalSelesai: values.tanggalSelesai,
      status: CampaignStatus.Draft,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    try {
      return await this.deps.campaigns.insert(campaign);
    } catch (error) {
      // A missing Brand is an input-validation problem, not a system error.
      if (error instanceof ForeignKeyError) {
        throw invalidBrandError();
      }
      // Any other failure (e.g. DB connectivity) propagates unchanged so the
      // API layer reports it as a system error, distinct from validation
      // (Req 6.14).
      throw error;
    }
  }

  /**
   * Create a Campaign inline, in the middle of the Promo_Scenario creation flow
   * (Req 7.12). The Campaign's Brand defaults to the owning promo's Brand
   * (`promoBrandId`); when the caller supplies a Brand it MUST equal the promo's
   * Brand, otherwise the save is rejected with a clear message (Req 7.14).
   * Every Campaign validation still applies — Brand wajib, Tanggal Selesai ≥
   * Tanggal Mulai, initial Status Draft, and the audit fields createdBy/
   * createdAt/updatedAt are stamped (Req 7.13) — because the work is delegated
   * to {@link create}.
   *
   * @param input The inline Campaign fields; `brandId` is optional and defaults
   *   to `promoBrandId`.
   * @param promoBrandId Brand of the Promo_Scenario being created; the inline
   *   Campaign is tied to this Brand.
   * @param actor Identifier of the creating user (recorded as createdBy).
   * @throws {ValidationError} when a field is invalid, the date range is
   *   inverted, the Brand is missing/non-existent, or the supplied Brand differs
   *   from the promo's Brand (Req 7.14).
   */
  async createInline(
    input: CreateInlineCampaignInput,
    promoBrandId: string,
    actor: string,
  ): Promise<Campaign> {
    const promoBrand =
      typeof promoBrandId === "string" ? promoBrandId.trim() : "";
    const requestedBrand =
      typeof input.brandId === "string" ? input.brandId.trim() : "";

    // Reject an inline Campaign whose Brand differs from the promo's Brand
    // (Req 7.14). An omitted/blank Brand is allowed and defaults to the promo's
    // Brand (Req 7.12).
    if (
      requestedBrand !== "" &&
      promoBrand !== "" &&
      requestedBrand !== promoBrand
    ) {
      throw brandMismatchError();
    }

    // Default the Campaign's Brand to the promo's Brand, then apply the full
    // Campaign validation + persistence path (Req 7.13).
    return this.create(
      {
        brandId: promoBrand,
        nama: input.nama,
        tanggalMulai: input.tanggalMulai,
        tanggalSelesai: input.tanggalSelesai,
      },
      actor,
    );
  }

  /**
   * Persist Campaign field changes only when every validation passes (Req 6.5).
   * On a validation error the save is blocked and the previously stored
   * Campaign is preserved (Req 6.6). `updatedAt` is refreshed while
   * createdBy/createdAt remain immutable (Req 6.13, 23.3).
   *
   * @throws {NotFoundError} when no Campaign has the given surrogate id.
   * @throws {ValidationError} when a field is invalid, the date range is
   *   inverted, or the Brand is missing/non-existent.
   */
  async update(
    id: string,
    changes: UpdateCampaignChanges,
  ): Promise<Campaign> {
    const existing = await this.deps.campaigns.findById(id);
    if (!existing) {
      throw new NotFoundError("Campaign", id);
    }

    const values = this.normalize({
      brandId: changes.brandId ?? existing.brandId,
      nama: changes.nama ?? existing.nama,
      tanggalMulai: changes.tanggalMulai ?? existing.tanggalMulai,
      tanggalSelesai: changes.tanggalSelesai ?? existing.tanggalSelesai,
      status: changes.status ?? existing.status,
    });
    this.assertValidFields(values);

    // Brand must still reference an existing Brand (Req 6.6).
    const brand = await this.deps.brands.findById(values.brandId);
    if (!brand) {
      throw invalidBrandError();
    }

    // createdBy/createdAt are carried over unchanged (immutable, Req 23.4);
    // only the mutable fields and updatedAt move forward.
    const updated: Campaign = {
      ...existing,
      brandId: values.brandId,
      nama: values.nama,
      tanggalMulai: values.tanggalMulai,
      tanggalSelesai: values.tanggalSelesai,
      status: values.status,
      updatedAt: new Date(),
    };

    try {
      return await this.deps.campaigns.update(updated);
    } catch (error) {
      if (error instanceof ForeignKeyError) {
        throw invalidBrandError();
      }
      throw error;
    }
  }

  /**
   * Mark a Campaign as archived without deleting its data (Req 6.9). Refreshes
   * `updatedAt`; createdBy/createdAt remain immutable.
   *
   * @throws {NotFoundError} when no Campaign has the given surrogate id.
   */
  async archive(id: string): Promise<Campaign> {
    const existing = await this.deps.campaigns.findById(id);
    if (!existing) {
      throw new NotFoundError("Campaign", id);
    }
    const archived: Campaign = {
      ...existing,
      status: CampaignStatus.Archived,
      updatedAt: new Date(),
    };
    return this.deps.campaigns.update(archived);
  }

  /**
   * Permanently delete a Campaign that has no related Promo_Scenario (Req 6.7).
   * When the Campaign still contains one or more Promo_Scenario the repository
   * raises a {@link ReferentialIntegrityError}; it is re-surfaced with a clear
   * message that the Campaign must be archived instead so its history stays
   * available for reporting and audit (Req 6.8).
   *
   * @throws {ReferentialIntegrityError} when related Promo_Scenario(s) still
   *   reference the Campaign.
   * @throws {NotFoundError} when no Campaign has the given surrogate id.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.deps.campaigns.delete(id);
    } catch (error) {
      if (error instanceof ReferentialIntegrityError) {
        throw new ReferentialIntegrityError(
          "Campaign",
          "Campaign masih memiliki Promo_Scenario terkait; arsipkan (Archive) Campaign sebagai gantinya agar riwayatnya tetap tersedia untuk pelaporan dan audit",
        );
      }
      throw error;
    }
  }

  /**
   * Trim string fields so leading/trailing whitespace never satisfies a
   * required-field check, and carry the date/status values through untouched
   * for validation.
   */
  private normalize(input: {
    brandId: string;
    nama: string;
    tanggalMulai: Date;
    tanggalSelesai: Date;
    status: CampaignStatus;
  }): CampaignFieldValues {
    return {
      brandId: typeof input.brandId === "string" ? input.brandId.trim() : "",
      nama: typeof input.nama === "string" ? input.nama.trim() : "",
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
      status: input.status,
    };
  }

  /**
   * Reject the operation when any required field is empty, a date is invalid,
   * Tanggal Selesai precedes Tanggal Mulai (Req 6.2), or the Status is not a
   * valid {@link CampaignStatus} (Req 6.4). Throws before any mutation so stored
   * data is left untouched (Req 6.6).
   */
  private assertValidFields(values: CampaignFieldValues): void {
    const fields: Record<string, string> = {};

    if (values.brandId === "") {
      fields.brandId = "Brand wajib diisi.";
    }
    if (values.nama === "") {
      fields.nama = "Nama Campaign wajib diisi.";
    }
    if (!isValidDate(values.tanggalMulai)) {
      fields.tanggalMulai = "Tanggal Mulai wajib diisi dan harus berupa tanggal yang valid.";
    }
    if (!isValidDate(values.tanggalSelesai)) {
      fields.tanggalSelesai = "Tanggal Selesai wajib diisi dan harus berupa tanggal yang valid.";
    }
    // Date-range check only when both endpoints are valid dates (Req 6.2).
    if (
      isValidDate(values.tanggalMulai) &&
      isValidDate(values.tanggalSelesai) &&
      values.tanggalSelesai.getTime() < values.tanggalMulai.getTime()
    ) {
      fields.tanggalSelesai =
        "Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.";
    }
    if (!Object.values(CampaignStatus).includes(values.status)) {
      fields.status =
        "Status harus berupa Draft, Active, Completed, atau Archived.";
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Data Campaign tidak valid.", fields);
    }
  }
}
