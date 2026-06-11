/**
 * PromoCloneService — high-frequency Promo_Scenario duplication.
 *
 * Cloning creates a new Draft promo from an existing source promo, copying its
 * promo type, rules, and product list while stamping fresh audit fields for the
 * user who performed the clone (Req 24 / Property 43).
 */

import { PromoStatus } from "../domain";
import type { PromoScenario, Rule } from "../domain";
import type { PromoScenarioRepository } from "../persistence";
import { NotFoundError } from "../persistence";

export interface PromoCloneServiceDeps {
  readonly promos: PromoScenarioRepository;
}

export class PromoCloneService {
  constructor(private readonly deps: PromoCloneServiceDeps) {}

  async clone(sourceId: string, actor: string): Promise<PromoScenario> {
    const source = await this.deps.promos.findById(sourceId);
    if (!source) {
      throw new NotFoundError("PromoScenario", sourceId);
    }

    const now = new Date();
    const cloned: PromoScenario = {
      id: crypto.randomUUID(),
      brandId: source.brandId,
      campaignId: source.campaignId,
      namaPromo: `${source.namaPromo} (Copy)`,
      promoType: source.promoType,
      tanggalMulai: new Date(source.tanggalMulai),
      tanggalSelesai: new Date(source.tanggalSelesai),
      status: PromoStatus.Draft,
      executionStatus: null,
      rules: this.cloneRules(source.rules),
      productRefs: source.productRefs.map((ref) => ({
        brandId: source.brandId,
        productId: ref.productId,
      })),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    return this.deps.promos.insert(cloned);
  }

  private cloneRules(rules: readonly Rule[]): Rule[] {
    return rules.map((rule) => ({
      id: crypto.randomUUID(),
      minQuantity: rule.minQuantity,
      benefitType: rule.benefitType,
      discountPercent: rule.discountPercent ?? null,
      gift: rule.gift ?? null,
    }));
  }
}
