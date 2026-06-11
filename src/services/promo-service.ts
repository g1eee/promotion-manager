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

import {
  BenefitType,
  ProductSelection,
  ProductSelectionError,
  PromoStatus,
  PromoType,
  RuleBuilder,
  RuleValidationError,
} from "../domain";
import type {
  BulkAddResult,
  Product,
  ProductRef,
  ProductSelectionItem,
  PromoScenario,
  Rule,
} from "../domain";
import type {
  BrandRepository,
  CampaignRepository,
  ProductRepository,
  PromoScenarioRepository,
} from "../persistence";
import { ForeignKeyError, NotFoundError } from "../persistence";
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

/** Mutable Basic Information fields for an existing Promo_Scenario (Req 7.9). */
export interface UpdatePromoChanges {
  brandId?: string;
  campaignId?: string;
  namaPromo?: string;
  promoType?: PromoType;
  tanggalMulai?: Date;
  tanggalSelesai?: Date;
}

/** Rule fields supplied by the Dynamic Rule Builder UI/API (Req 8.1). */
export interface CreateRuleInput {
  minQuantity: number;
  benefitType: BenefitType;
  discountPercent?: number | null;
  gift?: string | null;
}

/** Product selection projection for a Promo_Scenario (Req 9.1, 9.14). */
export interface PromoProductSelection {
  selected: ProductSelectionItem[];
  selectable: Product[];
}

/** Repository ports required by {@link PromoService}. */
export interface PromoServiceDeps {
  readonly promos: PromoScenarioRepository;
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
  readonly products: ProductRepository;
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

function mapRuleValidation(error: RuleValidationError): ValidationError {
  return new ValidationError(error.message, error.fields);
}

function mapProductSelection(error: ProductSelectionError): ValidationError {
  return new ValidationError(error.message, error.fields);
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

  /** Return one Promo_Scenario or raise a not-found error. */
  async get(id: string): Promise<PromoScenario> {
    const promo = await this.deps.promos.findById(id);
    if (!promo) {
      throw new NotFoundError("PromoScenario", id);
    }
    return promo;
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
   * Edit Promo_Scenario Basic Information (Req 7.9): changes are saved only
   * when the merged state is valid; invalid input rejects before persistence so
   * the previous promo stays intact (Req 7.10). Audit creation fields remain
   * immutable while `updatedAt` advances (Req 7.11, 23.3, 23.4).
   */
  async update(
    id: string,
    changes: UpdatePromoChanges,
  ): Promise<PromoScenario> {
    const existing = await this.get(id);
    const values = this.normalize({
      brandId: changes.brandId ?? existing.brandId,
      campaignId: changes.campaignId ?? existing.campaignId,
      namaPromo: changes.namaPromo ?? existing.namaPromo,
      promoType: changes.promoType ?? existing.promoType,
      tanggalMulai: changes.tanggalMulai ?? existing.tanggalMulai,
      tanggalSelesai: changes.tanggalSelesai ?? existing.tanggalSelesai,
    });
    this.assertValidFields(values);

    const campaign = await this.deps.campaigns.findById(values.campaignId);
    if (!campaign) {
      throw invalidCampaignError();
    }
    const brand = await this.deps.brands.findById(values.brandId);
    if (!brand) {
      throw invalidBrandError();
    }
    if (campaign.brandId !== values.brandId) {
      throw brandMismatchError();
    }

    const updated: PromoScenario = {
      ...existing,
      brandId: values.brandId,
      campaignId: values.campaignId,
      namaPromo: values.namaPromo,
      promoType: values.promoType,
      tanggalMulai: values.tanggalMulai,
      tanggalSelesai: values.tanggalSelesai,
      updatedAt: new Date(),
    };

    try {
      return await this.deps.promos.update(updated);
    } catch (error) {
      if (error instanceof ForeignKeyError) {
        if (error.message.includes("Campaign")) {
          throw invalidCampaignError();
        }
        throw invalidBrandError();
      }
      throw error;
    }
  }

  /**
   * Add one Dynamic Rule to a Promo_Scenario (Req 8.1, 8.2). The domain
   * RuleBuilder enforces minQuantity >= 1 (Req 8.3); this service validates the
   * benefit payload before persisting the updated promo.
   */
  async addRule(id: string, input: CreateRuleInput): Promise<PromoScenario> {
    const existing = await this.get(id);
    const rule = this.normalizeRule(input);

    try {
      const withRule = RuleBuilder.addRule(existing, rule);
      return await this.deps.promos.update({
        ...withRule,
        updatedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof RuleValidationError) {
        throw mapRuleValidation(error);
      }
      throw error;
    }
  }

  /**
   * Remove one Dynamic Rule from a Promo_Scenario (Req 8.4). Removing a missing
   * id is a no-op, matching the pure RuleBuilder behavior.
   */
  async removeRule(id: string, ruleId: string): Promise<PromoScenario> {
    const existing = await this.get(id);
    const withoutRule = RuleBuilder.removeRule(existing, ruleId);
    return this.deps.promos.update({
      ...withoutRule,
      updatedAt: new Date(),
    });
  }

  /** List selected products and selectable candidates for a promo (Req 9.1, 9.5, 9.11, 9.14). */
  async productSelection(
    id: string,
    criteria: { keyword?: string } = {},
  ): Promise<PromoProductSelection> {
    const promo = await this.get(id);
    const catalogue = await this.deps.products.list();
    const selected = ProductSelection.resolveSelectedItems(
      promo.productRefs,
      catalogue,
    );
    const keyword =
      typeof criteria.keyword === "string" ? criteria.keyword.trim() : "";
    const needle = keyword.toLowerCase();
    const selectable = ProductSelection.selectableProducts(
      catalogue,
      promo.brandId,
    ).filter((product) =>
      needle === ""
        ? true
        : product.productId.toLowerCase().includes(needle) ||
          product.namaProduk.toLowerCase().includes(needle),
    );
    return { selected, selectable };
  }

  /** Add one or many Product_Master products to a promo by Product ID (Req 9.2, 9.7). */
  async addProductsById(
    id: string,
    productIds: readonly string[],
  ): Promise<PromoScenario> {
    const promo = await this.get(id);
    const products: Product[] = [];
    for (const productId of productIds) {
      const matches = await this.deps.products.findByProductId(productId.trim());
      const product = matches.find((candidate) => candidate.brandId === promo.brandId);
      if (!product) {
        throw new ValidationError("Produk tidak ditemukan.", {
          productIds: `Product ID "${productId}" tidak ditemukan pada Brand promo.`,
        });
      }
      products.push(product);
    }

    try {
      const productRefs = ProductSelection.addProducts(
        promo.productRefs,
        products,
        promo.brandId,
      );
      return this.deps.promos.update({
        ...promo,
        productRefs,
        updatedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ProductSelectionError) {
        throw mapProductSelection(error);
      }
      throw error;
    }
  }

  /** Bulk paste Product IDs, persist added refs, and return the partition report (Req 9.6, 9.8, 9.9). */
  async bulkAddProductsById(
    id: string,
    productIds: readonly string[],
  ): Promise<{ promo: PromoScenario; result: BulkAddResult }> {
    const promo = await this.get(id);
    const catalogue = await this.deps.products.list();
    const result = ProductSelection.bulkAddByProductIds(
      promo.productRefs,
      productIds,
      catalogue,
      promo.brandId,
    );
    const updated = await this.deps.promos.update({
      ...promo,
      productRefs: result.refs,
      updatedAt: new Date(),
    });
    return { promo: updated, result: { ...result, refs: updated.productRefs } };
  }

  /** Remove one selected product reference from a promo (Req 9.4). */
  async removeProduct(
    id: string,
    productId: string,
  ): Promise<PromoScenario> {
    const promo = await this.get(id);
    const productRefs = ProductSelection.removeProduct(promo.productRefs, {
      brandId: promo.brandId,
      productId,
    });
    return this.deps.promos.update({
      ...promo,
      productRefs,
      updatedAt: new Date(),
    });
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

  private normalizeRule(input: CreateRuleInput): Rule {
    const minQuantity = Number(input.minQuantity);
    const benefitType = input.benefitType;
    const discountPercent =
      input.discountPercent === undefined || input.discountPercent === null
        ? null
        : Number(input.discountPercent);
    const gift =
      typeof input.gift === "string" ? input.gift.trim() : input.gift ?? null;

    const fields: Record<string, string> = {};
    if (!Object.values(BenefitType).includes(benefitType)) {
      fields.benefitType =
        "Benefit harus berupa DiscountPercent atau FreeGift.";
    }

    if (benefitType === BenefitType.DiscountPercent) {
      if (
        discountPercent === null ||
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        fields.discountPercent = "Diskon harus berada dalam rentang 0-100%.";
      }
    }

    if (benefitType === BenefitType.FreeGift) {
      if (typeof gift !== "string" || gift === "") {
        fields.gift = "Free gift wajib diisi.";
      }
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Data Rule tidak valid.", fields);
    }

    return {
      id: crypto.randomUUID(),
      minQuantity,
      benefitType,
      discountPercent:
        benefitType === BenefitType.DiscountPercent ? discountPercent : null,
      gift: benefitType === BenefitType.FreeGift ? gift : null,
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
