import { beforeEach, describe, expect, it } from "vitest";

import {
  BenefitType,
  BrandStatus,
  CampaignStatus,
  MarginHealth,
  ProductStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type Product,
  type PromoScenario,
  type Rule,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { CostConfigService } from "./cost-config-service";
import { ValidationError } from "./errors";
import { PromoSimulatorService } from "./promo-simulator-service";

const NOW = new Date("2025-09-01T00:00:00Z");

function brand(): Brand {
  return {
    id: "brand-kalova",
    brandId: "KALOVA",
    brandName: "Kalova",
    displayName: "Kalova",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function campaign(): Campaign {
  return {
    id: "campaign-1",
    brandId: "brand-kalova",
    nama: "Payday September",
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function product(
  productId: string,
  hpp: number,
  hargaJual = 100_000,
): Product {
  return {
    id: `product-${productId}`,
    brandId: "brand-kalova",
    productId,
    namaProduk: `Produk ${productId}`,
    kategori: "Default",
    hpp,
    hargaJual,
    status: ProductStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rule(
  id: string,
  minQuantity: number,
  discountPercent: number,
): Rule {
  return {
    id,
    minQuantity,
    benefitType: BenefitType.DiscountPercent,
    discountPercent,
    gift: null,
  };
}

function promo(rules: Rule[]): PromoScenario {
  return {
    id: "promo-1",
    brandId: "brand-kalova",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: PromoStatus.Draft,
    executionStatus: null,
    rules,
    productRefs: [
      { brandId: "brand-kalova", productId: "P-HEALTHY" },
      { brandId: "brand-kalova", productId: "P-WARNING" },
      { brandId: "brand-kalova", productId: "P-RISKY" },
    ],
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("PromoSimulatorService", () => {
  let persistence: InMemoryPersistence;
  let service: PromoSimulatorService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await persistence.brands.insert(brand());
    await persistence.campaigns.insert(campaign());
    await persistence.products.insert(product("P-HEALTHY", 50_000));
    await persistence.products.insert(product("P-WARNING", 75_000));
    await persistence.products.insert(product("P-RISKY", 85_000));

    service = new PromoSimulatorService({
      promos: persistence.promos,
      products: persistence.products,
      costConfigs: new CostConfigService(persistence),
    });
  });

  it("returns active cost metadata, detailed rows, and Margin Health summary", async () => {
    await persistence.promos.insert(promo([rule("rule-1", 1, 0)]));
    await new CostConfigService(persistence).update("brand-kalova", {
      adminFee: 10,
      shippingFee: 0,
      promoXtra: 0,
      feePesanan: 0,
      campaignFee: 0,
      promosiFee: 0,
      marketingFee: 0,
      adsSpending: 0,
      affiliateCommission: 0,
      operatingCost: 0,
    });

    const result = await service.simulate("promo-1");

    expect(result.activeCostConfig).toMatchObject({
      brandId: "brand-kalova",
      isActive: true,
    });
    expect(result.rows.map((row) => row.marginHealth)).toEqual([
      MarginHealth.Healthy,
      MarginHealth.Warning,
      MarginHealth.Risky,
    ]);
    expect(result.summary).toEqual({
      total: 3,
      healthy: 1,
      warning: 1,
      risky: 1,
    });
    expect(result.rows[0]).toMatchObject({
      productId: "P-HEALTHY",
      hargaNormal: 100_000,
      hargaPromo: 100_000,
      potongan: 0,
      marginRp: 50_000,
      npmRp: 40_000,
      npmPct: 40,
      npmDeferred: false,
    });
  });

  it("defaults to the highest minimum-quantity Rule and allows an explicit Rule", async () => {
    await persistence.promos.insert(
      promo([rule("rule-low", 1, 5), rule("rule-high", 5, 20)]),
    );
    await new CostConfigService(persistence).update("brand-kalova", {
      adminFee: 0,
      shippingFee: 0,
      promoXtra: 0,
      feePesanan: 0,
      campaignFee: 0,
      promosiFee: 0,
      marketingFee: 0,
      adsSpending: 0,
      affiliateCommission: 0,
      operatingCost: 0,
    });

    const defaulted = await service.simulate("promo-1");
    const explicit = await service.simulate("promo-1", { ruleId: "rule-low" });

    expect(defaulted.rule.id).toBe("rule-high");
    expect(defaulted.rows[0]?.hargaPromo).toBe(80_000);
    expect(explicit.rule.id).toBe("rule-low");
    expect(explicit.rows[0]?.hargaPromo).toBe(95_000);
  });

  it("defers NPM and Margin Health when active Cost Configuration is unavailable", async () => {
    await persistence.promos.insert(promo([rule("rule-1", 1, 0)]));

    const result = await service.simulate("promo-1");

    expect(result.activeCostConfig).toMatchObject({
      brandId: "brand-kalova",
      isActive: false,
    });
    expect(result.summary).toEqual({
      total: 3,
      healthy: 0,
      warning: 0,
      risky: 0,
    });
    expect(result.rows.every((row) => row.npmDeferred)).toBe(true);
    expect(result.rows.every((row) => row.npmRp === null)).toBe(true);
    expect(result.rows.every((row) => row.marginHealth === null)).toBe(true);
  });

  it("rejects simulation until the promo has at least one Rule", async () => {
    await persistence.promos.insert(promo([]));

    await expect(service.simulate("promo-1")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
