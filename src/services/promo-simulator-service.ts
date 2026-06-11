/**
 * PromoSimulatorService - application orchestration for Req 11 and Req 20.
 *
 * The pure Simulator owns the arithmetic. This service gathers the persisted
 * promo, selected Product_Master rows, and the Brand cost configuration, then
 * returns the transparent payload used by the inline simulator UI/API.
 */

import {
  MarginHealth,
  ProductSelection,
  Simulator,
  type ActiveCostConfigInfo,
  type CostConfiguration,
  type Rule,
  type SimulatedProduct,
} from "../domain";
import type {
  ProductRepository,
  PromoScenarioRepository,
} from "../persistence";
import { NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

export interface PromoSimulatorCostConfigReader {
  get(brandId: string): Promise<CostConfiguration>;
}

export interface PromoSimulatorServiceDeps {
  readonly promos: PromoScenarioRepository;
  readonly products: ProductRepository;
  readonly costConfigs: PromoSimulatorCostConfigReader;
}

export interface SimulatePromoInput {
  readonly ruleId?: string | null;
}

export interface SimulatedPromoRow extends SimulatedProduct {
  readonly namaProduk: string;
  readonly marginHealth: MarginHealth | null;
}

export interface PromoSimulatorSummary {
  readonly total: number;
  readonly healthy: number;
  readonly warning: number;
  readonly risky: number;
}

export interface PromoSimulationResult {
  readonly activeCostConfig: ActiveCostConfigInfo;
  readonly rule: Rule;
  readonly rows: SimulatedPromoRow[];
  readonly summary: PromoSimulatorSummary;
}

function selectDefaultRule(rules: readonly Rule[]): Rule | null {
  let selected: Rule | null = null;
  for (const rule of rules) {
    if (!Number.isFinite(rule.minQuantity)) {
      continue;
    }
    if (selected === null || rule.minQuantity > selected.minQuantity) {
      selected = rule;
    }
  }
  return selected;
}

function resolveRule(
  rules: readonly Rule[],
  input: SimulatePromoInput,
): Rule {
  if (rules.length === 0) {
    throw new ValidationError("Tambahkan minimal satu Rule sebelum menjalankan simulator.", {
      ruleId: "Promo belum memiliki Rule.",
    });
  }

  const requestedRuleId =
    typeof input.ruleId === "string" ? input.ruleId.trim() : "";
  if (requestedRuleId !== "") {
    const requested = rules.find((rule) => rule.id === requestedRuleId);
    if (!requested) {
      throw new ValidationError("Rule simulator tidak ditemukan.", {
        ruleId: "Pilih Rule yang tersedia pada promo ini.",
      });
    }
    return requested;
  }

  const selected = selectDefaultRule(rules);
  if (!selected) {
    throw new ValidationError("Rule simulator tidak valid.", {
      ruleId: "Tidak ada Rule dengan Minimum Qty yang valid.",
    });
  }
  return selected;
}

function summarize(rows: readonly SimulatedPromoRow[]): PromoSimulatorSummary {
  let healthy = 0;
  let warning = 0;
  let risky = 0;

  for (const row of rows) {
    switch (row.marginHealth) {
      case MarginHealth.Healthy:
        healthy += 1;
        break;
      case MarginHealth.Warning:
        warning += 1;
        break;
      case MarginHealth.Risky:
        risky += 1;
        break;
      case null:
        break;
    }
  }

  return {
    total: rows.length,
    healthy,
    warning,
    risky,
  };
}

export class PromoSimulatorService {
  constructor(private readonly deps: PromoSimulatorServiceDeps) {}

  async simulate(
    promoId: string,
    input: SimulatePromoInput = {},
  ): Promise<PromoSimulationResult> {
    const promo = await this.deps.promos.findById(promoId);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoId);
    }

    const rule = resolveRule(promo.rules, input);
    const catalogue = await this.deps.products.list();
    const selectedProducts = ProductSelection.resolveSelectedItems(
      promo.productRefs,
      catalogue,
    );
    const costConfig = await this.deps.costConfigs.get(promo.brandId);
    const activeCostConfig = Simulator.activeCostConfigInfo(costConfig);

    const rows = selectedProducts.map((product) => {
      const simulated = Simulator.simulate(product, rule, costConfig);
      const marginHealth =
        simulated.npmPct === null
          ? null
          : Simulator.classifyMarginHealth(simulated.npmPct);
      return {
        ...simulated,
        namaProduk: product.namaProduk,
        marginHealth,
      };
    });

    return {
      activeCostConfig,
      rule,
      rows,
      summary: summarize(rows),
    };
  }
}
