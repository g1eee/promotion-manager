/**
 * PromoTemplateService — manage reusable promo templates (Req 5).
 *
 * Provides the five built-in templates (Buy X Discount Y%, Buy X Get Free Gift,
 * Voucher Discount, Flash Sale, Bundle Promo) and full CRUD over an unlimited
 * number of custom templates (Req 5.1–5.5). On a validation/system failure the
 * service throws a specific {@link ValidationError} and never partially writes,
 * so existing template data is preserved (Req 5.6).
 *
 * Seeding is idempotent: {@link ensureSeeded} inserts any missing built-in by a
 * stable surrogate id, so repeated calls (e.g. on each request in the in-memory
 * adapter) never duplicate the built-ins.
 *
 * Depends only on repository ports (Dependency Inversion), so it runs against
 * the in-memory adapter in tests and a database-backed adapter later unchanged.
 */

import { BenefitType, PromoType } from "../domain";
import type { PromoTemplate, PromoTemplateConfig } from "../domain";
import type { PromoTemplateRepository } from "../persistence";
import { NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

export interface PromoTemplateServiceDeps {
  readonly templates: PromoTemplateRepository;
}

/** Fields accepted when creating or updating a template. */
export interface PromoTemplateInput {
  name: string;
  promoType: PromoType | null;
  config: PromoTemplateConfig;
}

/** A built-in template seed definition with a stable surrogate id. */
interface BuiltInSeed {
  readonly id: string;
  readonly name: string;
  readonly promoType: PromoType;
  readonly config: PromoTemplateConfig;
}

/** The five built-in templates seeded for every install (Req 5.1). */
export const BUILT_IN_TEMPLATES: readonly BuiltInSeed[] = [
  {
    id: "template-buy-x-discount",
    name: "Buy X Discount Y%",
    promoType: PromoType.BuyXDiscount,
    config: {
      rules: [
        {
          minQuantity: 1,
          benefitType: BenefitType.DiscountPercent,
          discountPercent: 10,
          gift: null,
        },
      ],
    },
  },
  {
    id: "template-buy-x-get-gift",
    name: "Buy X Get Free Gift",
    promoType: PromoType.BuyXGetGift,
    config: {
      rules: [
        {
          minQuantity: 2,
          benefitType: BenefitType.FreeGift,
          discountPercent: null,
          gift: "Free Gift",
        },
      ],
    },
  },
  {
    id: "template-voucher-discount",
    name: "Voucher Discount",
    promoType: PromoType.Voucher,
    config: {
      rules: [
        {
          minQuantity: 1,
          benefitType: BenefitType.DiscountPercent,
          discountPercent: 15,
          gift: null,
        },
      ],
    },
  },
  {
    id: "template-flash-sale",
    name: "Flash Sale",
    promoType: PromoType.FlashSale,
    config: {
      rules: [
        {
          minQuantity: 1,
          benefitType: BenefitType.DiscountPercent,
          discountPercent: 25,
          gift: null,
        },
      ],
    },
  },
  {
    id: "template-bundle-promo",
    name: "Bundle Promo",
    promoType: PromoType.BundlePromo,
    config: {
      rules: [
        {
          minQuantity: 3,
          benefitType: BenefitType.DiscountPercent,
          discountPercent: 20,
          gift: null,
        },
      ],
    },
  },
];

function emptyNameError(): ValidationError {
  return new ValidationError("Template tidak valid.", {
    name: "Nama template wajib diisi.",
  });
}

function invalidConfigError(message: string): ValidationError {
  return new ValidationError("Konfigurasi template tidak valid.", {
    config: message,
  });
}

/** Validate the template config rules (min qty >= 1, benefit consistency). */
function assertValidConfig(config: PromoTemplateConfig): void {
  if (!config || !Array.isArray(config.rules)) {
    throw invalidConfigError("Template harus memiliki daftar rules.");
  }
  for (const rule of config.rules) {
    if (!Number.isFinite(rule.minQuantity) || rule.minQuantity < 1) {
      throw invalidConfigError("Minimum quantity setiap rule minimal 1.");
    }
    if (rule.benefitType === BenefitType.DiscountPercent) {
      const pct = rule.discountPercent ?? 0;
      if (!Number.isFinite(pct) || pct < 0) {
        throw invalidConfigError("Discount percent tidak valid.");
      }
    }
  }
}

export class PromoTemplateService {
  constructor(private readonly deps: PromoTemplateServiceDeps) {}

  /**
   * Idempotently seed the five built-in templates (Req 5.1). Missing built-ins
   * are inserted by their stable id; existing ones are left untouched.
   */
  async ensureSeeded(): Promise<void> {
    const existing = await this.deps.templates.list();
    const existingIds = new Set(existing.map((template) => template.id));
    const now = new Date();
    for (const seed of BUILT_IN_TEMPLATES) {
      if (existingIds.has(seed.id)) {
        continue;
      }
      const template: PromoTemplate = {
        id: seed.id,
        name: seed.name,
        promoType: seed.promoType,
        config: seed.config,
        isBuiltIn: true,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await this.deps.templates.insert(template);
      } catch {
        // Concurrent seed already inserted it; ignore.
      }
    }
  }

  /** List all templates (built-in + custom). */
  async list(): Promise<PromoTemplate[]> {
    return this.deps.templates.list();
  }

  /**
   * Create a new custom template and store it in the template list (Req 5.2).
   * An unlimited number of templates is supported (Req 5.3).
   *
   * @throws {ValidationError} when the name is blank or the config is invalid.
   */
  async create(input: PromoTemplateInput, actor: string): Promise<PromoTemplate> {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name === "") {
      throw emptyNameError();
    }
    assertValidConfig(input.config);

    const now = new Date();
    const template: PromoTemplate = {
      id: crypto.randomUUID(),
      name,
      promoType: input.promoType,
      config: input.config,
      isBuiltIn: false,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    return this.deps.templates.insert(template);
  }

  /**
   * Persist changes to a template (Req 5.4). Validation runs before any write
   * so a failure preserves the stored template (Req 5.6).
   *
   * @throws {NotFoundError} when no template has the given id.
   * @throws {ValidationError} when the name is blank or the config is invalid.
   */
  async update(
    id: string,
    input: PromoTemplateInput,
  ): Promise<PromoTemplate> {
    const existing = await this.deps.templates.findById(id);
    if (!existing) {
      throw new NotFoundError("PromoTemplate", id);
    }
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name === "") {
      throw emptyNameError();
    }
    assertValidConfig(input.config);

    const updated: PromoTemplate = {
      ...existing,
      name,
      promoType: input.promoType,
      config: input.config,
      updatedAt: new Date(),
    };
    return this.deps.templates.update(updated);
  }

  /**
   * Remove a template from the list (Req 5.5).
   *
   * @throws {NotFoundError} when no template has the given id.
   */
  async delete(id: string): Promise<void> {
    await this.deps.templates.delete(id);
  }
}
