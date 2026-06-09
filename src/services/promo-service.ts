/**
 * PromoService — Promo_Scenario Management (Basic Information), a promo
 * definition owned by exactly one Brand and belonging to exactly one Campaign
 * (Req 7, Req 6.10–6.12, Req 23).
 *
 * Responsibilities (design "Components and Interfaces → Promo Scenario"):
 * - `create` validates the required Basic Information fields, requires the promo
 *   to be associated with exactly one EXISTING Campaign (Req 7.2, 6.10),
 *   enforces that the promo's Brand equals its Campaign's Brand (Req 7.3, 6.12),
 *   enforces that Tanggal Selesai is on or after Tanggal Mulai (Req 7.4),
 *   requires an existing Brand (Req 7.5), restricts Promo_Type to the allowed
 *   values (Req 7.6, 7.7), stores the promo with the initial Status Draft tied
 *   to exactly one Brand and one Campaign (Req 7.1), and stamps the audit fields
 *   createdBy/createdAt/updatedAt (Req 7.11, 23.2).
 *
 * System errors (e.g. a database-connectivity failure) are deliberately NOT
 * wrapped as {@link ValidationError}: only deterministic input-validation
 * failures raise {@link ValidationError}, so the API layer can distinguish a
 * system error (500) from an input-validation rejection (Req 7.x error
 * handling, mirroring Campaign Req 6.14).
 *
 * Like the sibling services, this service depends only on repository ports
 * (Dependency Inversion), so it works against the in-memory adapter in tests and
 * a database-backed adapter later without code changes.
 */

import { PromoStatus, PromoType } from "../domain";
import type { ProductRef, PromoScenario, Rule } from "../domain";
import type {
  BrandRepository,
  CampaignRepository,
  PromoScenarioRepository,
} from "../persistence";
import { ForeignKeyError } from "../persistence";
import {
  CampaignService,
  type CreateInlineCampaignInput,
} from "./campaign-service";
import { ValidationError } from "./errors";

/** Fields required to create a Promo_Scenario Basic Information (Req 7.1). */
export interface CreatePromoInput {
  /** Owning Brand surrogate id; must reference an existing Brand (Req 7.5). */
  brandId: string;
  /**
   * Owning Campaign surrogate id; must reference an existing Campaign (Req 7.2,
   * 6.10) whose Brand equals this promo's Brand (Req 7.3, 6.12).
   */
  campaignId: string;
  /** Promo name (Nama Promo). */
  namaPromo: string;
  /** One of the allowed {@link PromoType} values (Req 7.6). */
  promoType: PromoType;
  tanggalMulai: Date;
  /** Must be on or after `tanggalMulai` (Req 7.4). */
  tanggalSelesai: Date;
}

/**
 * Fields required to create a Promo_Scenario together with a brand-new Campaign
 * created inline in the same flow (Req 7.12). It mirrors {@link CreatePromoInput}
 * but omits `campaignId`, because the owning Campaign does not exist yet — it is
 * created first and its surrogate id is then associated to the promo.
 */
export type CreatePromoWithInlineCampaignInput = Omit<
  CreatePromoInput,
  "campaignId"
>;

/** Repository ports required by {@link PromoService}. */
export interface PromoServiceDeps {
  readonly promos: PromoScenarioRepository;
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
}

/** Final, trimmed/normalized Promo field values fed to validation. */
interface PromoFieldValues {
  brandId: string;
  campaignId: string;
  namaPromo: string;
  promoType: PromoType;
  tanggalMulai: Date;
  tanggalSelesai: Date;
}

/** Clear, user-facing invalid/missing Brand validation failure (Req 7.5). */
function invalidBrandError(): ValidationError {
  return new ValidationError("Brand tidak valid.", {
    brandId: "Brand wajib diisi dan harus berupa Brand yang terdaftar.",
  });
}

/** Clear, user-facing missing/non-existent Campaign failure (Req 7.2, 6.10). */
function invalidCampaignError(): ValidationError {
  return new ValidationError("Campaign tidak valid.", {
    campaignId:
      "Promo harus menjadi bagian dari tepat satu Campaign yang sudah ada.",
  });
}

/** Brand promo must match Brand campaign (Req 7.3, 6.12). */
function brandMismatchError(): ValidationError {
  return new ValidationError("Brand promo harus sama dengan Brand campaign.", {
    brandId: "Brand promo harus sama dengan Brand campaign-nya.",
  });
}

/** Whether a value is a usable (non-NaN) Date instance. */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export class PromoService {
  constructor(private readonly deps: PromoServiceDeps) {}

  /** List Promo_Scenario, optionally narrowed by Brand and/or Campaign. */
  async list(filter?: {
    brandId?: string;
    campaignId?: string;
    status?: PromoStatus;
  }): Promise<PromoScenario[]> {
    return this.deps.promos.list(filter);
  }

  /**
   * Validate and persist a new Promo_Scenario with the initial Status Draft,
   * tied to exactly one existing Brand and exactly one existing Campaign whose
   * Brand matches the promo's Brand, with audit fields stamped (Req 7.1, 7.2,
   * 7.3, 7.4, 7.5, 7.6, 7.7, 7.11, 6.10, 6.11, 6.12, 23.2).
   *
   * @param input The Basic Information fields supplied by the user.
   * @param actor Identifier of the creating user (recorded as createdBy).
   * @throws {ValidationError} when a required field is missing/invalid, the date
   *   range is inverted, the Promo_Type is invalid, the Brand is missing/
   *   non-existent, the Campaign is missing/non-existent, or the promo Brand
   *   differs from its Campaign's Brand.
   */
  async create(input: CreatePromoInput, actor: string): Promise<PromoScenario> {
    // New promos always begin as Draft (Req 7.1); status is not user input.
    const values = this.normalize(input);
    this.assertValidFields(values);

    // Campaign must exist before anything is saved (Req 7.2, 6.10).
    const campaign = await this.deps.campaigns.findById(values.campaignId);
    if (!campaign) {
      throw invalidCampaignError();
    }

    // Brand must exist before anything is saved (Req 7.5).
    const brand = await this.deps.brands.findById(values.brandId);
    if (!brand) {
      throw invalidBrandError();
    }

    // Promo Brand must be consistent with its Campaign's Brand (Req 7.3, 6.12).
    if (campaign.brandId !== values.brandId) {
      throw brandMismatchError();
    }

    const now = new Date();
    const rules: Rule[] = [];
    const productRefs: ProductRef[] = [];
    const promo: PromoScenario = {
      id: crypto.randomUUID(),
      brandId: values.brandId,
      campaignId: values.campaignId,
      namaPromo: values.namaPromo,
      promoType: values.promoType,
      tanggalMulai: values.tanggalMulai,
      tanggalSelesai: values.tanggalSelesai,
      status: PromoStatus.Draft,
      executionStatus: null,
      rules,
      productRefs,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    try {
      return await this.deps.promos.insert(promo);
    } catch (error) {
      // A missing Brand/Campaign is an input-validation problem, not a system
      // error: surface it as a ValidationError.
      if (error instanceof ForeignKeyError) {
        if (error.message.includes("Campaign")) {
          throw invalidCampaignError();
        }
        throw invalidBrandError();
      }
      // Any other failure (e.g. DB connectivity) propagates unchanged so the
      // API layer reports it as a system error, distinct from validation.
      throw error;
    }
  }

  /**
   * Create a Promo_Scenario together with a brand-new Campaign created inline in
   * the same flow (Req 7.12): the user defines the promo first, then its
   * Campaign. Campaign creation is delegated to {@link CampaignService.createInline}
   * with the Campaign's Brand defaulting to the promo's Brand (Brand ter-default
   * = Brand promo); the new Campaign's surrogate id is then associated to the
   * promo via {@link create}.
   *
   * Brand consistency between Campaign and promo is enforced (Req 7.14) — the
   * inline Campaign rejects a Brand that differs from the promo's Brand — and the
   * full set of Campaign validations still applies (Brand wajib, Tanggal Selesai
   * ≥ Tanggal Mulai, initial Status Draft, audit fields stamped) because the work
   * is delegated to the Campaign service (Req 7.13). Likewise every promo
   * validation runs via {@link create}.
   *
   * @param promo The Basic Information fields for the promo (without a Campaign,
   *   which is created here).
   * @param newCampaign The inline Campaign fields; `brandId` is optional and
   *   defaults to the promo's Brand.
   * @param actor Identifier of the creating user (recorded as createdBy on both
   *   the Campaign and the promo).
   * @throws {ValidationError} when any promo or Campaign field is invalid, a date
   *   range is inverted, a Brand is missing/non-existent, or the inline
   *   Campaign's Brand differs from the promo's Brand (Req 7.14).
   */
  async createWithInlineCampaign(
    promo: CreatePromoWithInlineCampaignInput,
    newCampaign: CreateInlineCampaignInput,
    actor: string,
  ): Promise<PromoScenario> {
    // Delegate Campaign creation, defaulting its Brand to the promo's Brand and
    // enforcing Brand consistency + all Campaign validations (Req 7.12–7.14).
    const campaignService = new CampaignService({
      campaigns: this.deps.campaigns,
      brands: this.deps.brands,
    });
    const promoBrandId =
      typeof promo.brandId === "string" ? promo.brandId.trim() : "";
    const campaign = await campaignService.createInline(
      newCampaign,
      promoBrandId,
      actor,
    );

    // Associate the promo to the freshly created Campaign and run the full promo
    // validation + persistence path (incl. Brand-consistency, Req 7.3/6.12).
    return this.create({ ...promo, campaignId: campaign.id }, actor);
  }

  /**
   * Trim string fields so leading/trailing whitespace never satisfies a
   * required-field check, and carry the date/type values through untouched for
   * validation.
   */
  private normalize(input: CreatePromoInput): PromoFieldValues {
    return {
      brandId: typeof input.brandId === "string" ? input.brandId.trim() : "",
      campaignId:
        typeof input.campaignId === "string" ? input.campaignId.trim() : "",
      namaPromo:
        typeof input.namaPromo === "string" ? input.namaPromo.trim() : "",
      promoType: input.promoType,
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
    };
  }

  /**
   * Reject the operation when any required field is empty, a date is invalid,
   * Tanggal Selesai precedes Tanggal Mulai (Req 7.4), or the Promo_Type is not a
   * valid {@link PromoType} (Req 7.6, 7.7). Throws before any mutation so stored
   * data is left untouched.
   */
  private assertValidFields(values: PromoFieldValues): void {
    const fields: Record<string, string> = {};

    if (values.brandId === "") {
      fields.brandId = "Brand wajib diisi.";
    }
    if (values.campaignId === "") {
      fields.campaignId = "Campaign wajib diisi.";
    }
    if (values.namaPromo === "") {
      fields.namaPromo = "Nama Promo wajib diisi.";
    }
    if (!Object.values(PromoType).includes(values.promoType)) {
      fields.promoType =
        "Promo Type harus berupa Buy X Discount, Buy X Get Gift, Voucher, Flash Sale, atau Bundle Promo.";
    }
    if (!isValidDate(values.tanggalMulai)) {
      fields.tanggalMulai =
        "Tanggal Mulai wajib diisi dan harus berupa tanggal yang valid.";
    }
    if (!isValidDate(values.tanggalSelesai)) {
      fields.tanggalSelesai =
        "Tanggal Selesai wajib diisi dan harus berupa tanggal yang valid.";
    }
    // Date-range check only when both endpoints are valid dates (Req 7.4).
    if (
      isValidDate(values.tanggalMulai) &&
      isValidDate(values.tanggalSelesai) &&
      values.tanggalSelesai.getTime() < values.tanggalMulai.getTime()
    ) {
      fields.tanggalSelesai =
        "Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.";
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Data Promo tidak valid.", fields);
    }
  }
}
