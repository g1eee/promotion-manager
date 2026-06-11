import { describe, expect, it } from "vitest";

import { BenefitType, MarginHealth } from "./enums";
import { COST_COMPONENT_KEYS, Simulator } from "./simulator";
import type { CostConfiguration, Product, Rule } from "./types";

let ruleSeq = 0;
let productSeq = 0;

/** Build a discount-percent Rule (Req 10.1), overridable. */
function rule(overrides: Partial<Rule> = {}): Rule {
  ruleSeq += 1;
  return {
    id: `rule-${ruleSeq}`,
    minQuantity: 1,
    benefitType: BenefitType.DiscountPercent,
    discountPercent: 10,
    gift: null,
    ...overrides,
  };
}

/** Build a Product, defaulting to a simple priced item. */
function product(overrides: Partial<Product> = {}): Product {
  productSeq += 1;
  return {
    id: `product-${productSeq}`,
    brandId: "brand-1",
    productId: `P-${productSeq}`,
    namaProduk: `Produk ${productSeq}`,
    kategori: "default",
    hpp: 5_000,
    hargaJual: 10_000,
    status: "Active" as Product["status"],
    createdBy: "user-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** Build a CostConfiguration; defaults all ten components to 0 and active. */
function costConfig(overrides: Partial<CostConfiguration> = {}): CostConfiguration {
  return {
    id: "cost-1",
    brandId: "brand-1",
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
    isActive: true,
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("Simulator.sumCostComponents sums the ten components (Req 11.2)", () => {
  it("sums all ten components as a whole-number percent", () => {
    const cfg = costConfig({
      adminFee: 1,
      shippingFee: 2,
      promoXtra: 3,
      feePesanan: 4,
      campaignFee: 5,
      promosiFee: 6,
      marketingFee: 7,
      adsSpending: 8,
      affiliateCommission: 9,
      operatingCost: 10,
    });
    // 1+2+...+10 = 55.
    expect(Simulator.sumCostComponents(cfg)).toBe(55);
  });

  it("returns 0 when every component is 0", () => {
    expect(Simulator.sumCostComponents(costConfig())).toBe(0);
  });

  it("declares exactly the ten canonical cost component keys", () => {
    expect([...COST_COMPONENT_KEYS]).toEqual([
      "adminFee",
      "shippingFee",
      "promoXtra",
      "feePesanan",
      "campaignFee",
      "promosiFee",
      "marketingFee",
      "adsSpending",
      "affiliateCommission",
      "operatingCost",
    ]);
  });
});

describe("Simulator.activeCostConfigInfo exposes active cost metadata (Req 11.8)", () => {
  it("returns Brand, active flag, and Last Updated Date", () => {
    const updatedAt = new Date("2024-04-05T06:07:08Z");
    const cfg = costConfig({
      brandId: "brand-transparent",
      isActive: true,
      updatedAt,
    });

    expect(Simulator.activeCostConfigInfo(cfg)).toEqual({
      brandId: "brand-transparent",
      isActive: true,
      lastUpdatedDate: updatedAt,
    });
  });

  it("surfaces inactive configs so the UI can show deferred NPM basis", () => {
    const cfg = costConfig({ isActive: false });

    expect(Simulator.activeCostConfigInfo(cfg).isActive).toBe(false);
  });
});

describe("Simulator.simulate produces the seven outputs (Req 11.1–11.6)", () => {
  it("computes all seven outputs with all ten cost components active", () => {
    // hargaJual 100_000, 20% off -> promo 80_000, hpp 50_000.
    const p = product({ hargaJual: 100_000, hpp: 50_000 });
    const r = rule({ discountPercent: 20 });
    // Components sum to 30% -> cost = 80_000 * 0.30 = 24_000.
    const cfg = costConfig({
      adminFee: 8,
      shippingFee: 5,
      promoXtra: 2,
      feePesanan: 1,
      campaignFee: 3,
      promosiFee: 2,
      marketingFee: 4,
      adsSpending: 3,
      affiliateCommission: 1,
      operatingCost: 1,
    });

    const result = Simulator.simulate(p, r, cfg);

    expect(result.hargaNormal).toBe(100_000);
    expect(result.hargaPromo).toBe(80_000);
    expect(result.potongan).toBe(20_000); // 100_000 - 80_000
    expect(result.marginRp).toBe(30_000); // 80_000 - 50_000
    expect(result.marginPct).toBeCloseTo(37.5); // 30_000 / 80_000 * 100
    // NPM Rp = 30_000 - (80_000 * 30/100) = 30_000 - 24_000 = 6_000.
    expect(result.npmRp).toBe(6_000);
    expect(result.npmPct).toBeCloseTo(7.5); // 6_000 / 80_000 * 100
    expect(result.npmDeferred).toBe(false);
  });

  it("carries the product identity (brandId, productId)", () => {
    const p = product({ brandId: "brand-9", productId: "KAL-777" });
    const result = Simulator.simulate(p, rule(), costConfig());
    expect(result.brandId).toBe("brand-9");
    expect(result.productId).toBe("KAL-777");
  });

  it("computes Potongan as Harga Normal − Harga Promo (Req 11.6)", () => {
    const p = product({ hargaJual: 50_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 10 }), costConfig());
    expect(result.potongan).toBe(result.hargaNormal - result.hargaPromo);
    expect(result.potongan).toBe(5_000);
  });
});

describe("Simulator.simulate preserves negative margins without clamping (Req 11.4, 11.5)", () => {
  it("yields a negative Margin Rp when HPP exceeds Harga Promo", () => {
    // 10% off 10_000 -> promo 9_000; hpp 12_000 -> margin -3_000.
    const p = product({ hargaJual: 10_000, hpp: 12_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 10 }), costConfig());
    expect(result.hargaPromo).toBe(9_000);
    expect(result.marginRp).toBe(-3_000);
    expect(result.marginPct).toBeCloseTo((-3_000 / 9_000) * 100);
  });

  it("yields a negative Margin Rp for a discount above 100%", () => {
    // 150% off 10_000 -> promo -5_000; hpp 5_000 -> margin -10_000.
    const p = product({ hargaJual: 10_000, hpp: 5_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 150 }), costConfig());
    expect(result.hargaPromo).toBe(-5_000);
    expect(result.marginRp).toBe(-10_000);
  });

  it("reports Margin %/NPM % as null when Harga Promo is 0 (full discount)", () => {
    // 100% off 10_000 -> promo 0.
    const p = product({ hargaJual: 10_000, hpp: 4_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 100 }), costConfig());
    expect(result.hargaPromo).toBe(0);
    expect(result.marginRp).toBe(-4_000); // still computed
    expect(result.marginPct).toBeNull();
    expect(result.npmRp).toBe(-4_000); // margin - 0
    expect(result.npmPct).toBeNull();
  });
});

describe("Simulator.simulate includes HPP and all ten components in NPM (Req 11.2)", () => {
  it("NPM Rp equals Margin Rp minus Harga Promo × Σcomponents/100", () => {
    const p = product({ hargaJual: 100_000, hpp: 40_000 });
    const r = rule({ discountPercent: 0 }); // promo == normal == 100_000
    const cfg = costConfig({
      adminFee: 10,
      shippingFee: 10,
      operatingCost: 5,
    }); // Σ = 25%

    const result = Simulator.simulate(p, r, cfg);

    expect(result.hargaPromo).toBe(100_000);
    expect(result.marginRp).toBe(60_000);
    // NPM Rp = 60_000 - 100_000 * 0.25 = 60_000 - 25_000 = 35_000.
    expect(result.npmRp).toBe(35_000);
  });
});

describe("Simulator.simulate defers NPM when cost config is inactive/unavailable (Req 11.7)", () => {
  it("defers NPM when isActive is false but still produces the other five outputs", () => {
    const p = product({ hargaJual: 100_000, hpp: 50_000 });
    const r = rule({ discountPercent: 20 });
    const cfg = costConfig({ adminFee: 8, shippingFee: 5, isActive: false });

    const result = Simulator.simulate(p, r, cfg);

    expect(result.npmDeferred).toBe(true);
    expect(result.npmRp).toBeNull();
    expect(result.npmPct).toBeNull();
    // The other five outputs are unaffected.
    expect(result.hargaNormal).toBe(100_000);
    expect(result.hargaPromo).toBe(80_000);
    expect(result.potongan).toBe(20_000);
    expect(result.marginRp).toBe(30_000);
    expect(result.marginPct).toBeCloseTo(37.5);
  });

  it("defers NPM when cost config is null", () => {
    const p = product({ hargaJual: 100_000, hpp: 50_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 20 }), null);
    expect(result.npmDeferred).toBe(true);
    expect(result.npmRp).toBeNull();
    expect(result.npmPct).toBeNull();
    expect(result.marginRp).toBe(30_000);
  });

  it("defers NPM when cost config is undefined", () => {
    const p = product({ hargaJual: 100_000, hpp: 50_000 });
    const result = Simulator.simulate(p, rule({ discountPercent: 20 }), undefined);
    expect(result.npmDeferred).toBe(true);
    expect(result.npmRp).toBeNull();
  });
});

describe("Simulator.simulateAll applies the SAME Rule to all products (Req 10.3, 11.1)", () => {
  it("simulates every product with the same discount and cost config", () => {
    const products = [
      product({ hargaJual: 100_000, hpp: 50_000 }),
      product({ hargaJual: 200_000, hpp: 80_000 }),
    ];
    const r = rule({ discountPercent: 10 });
    const cfg = costConfig({ adminFee: 10 }); // Σ = 10%

    const results = Simulator.simulateAll(products, r, cfg);

    expect(results).toHaveLength(2);
    // Product A: promo 90_000, margin 40_000, NPM = 40_000 - 9_000 = 31_000.
    expect(results[0]!.hargaPromo).toBe(90_000);
    expect(results[0]!.marginRp).toBe(40_000);
    expect(results[0]!.npmRp).toBe(31_000);
    // Product B: promo 180_000, margin 100_000, NPM = 100_000 - 18_000 = 82_000.
    expect(results[1]!.hargaPromo).toBe(180_000);
    expect(results[1]!.marginRp).toBe(100_000);
    expect(results[1]!.npmRp).toBe(82_000);
  });

  it("preserves input order and returns an empty array for no products", () => {
    const products = [
      product({ productId: "A" }),
      product({ productId: "B" }),
      product({ productId: "C" }),
    ];
    const results = Simulator.simulateAll(products, rule(), costConfig());
    expect(results.map((x) => x.productId)).toEqual(["A", "B", "C"]);
    expect(Simulator.simulateAll([], rule(), costConfig())).toEqual([]);
  });
});

describe("MarginHealth.classify derives health from NPM% (Req 20.1-20.4)", () => {
  it("classifies NPM% at and above 20 as Healthy", () => {
    expect(MarginHealth.classify(20)).toBe(MarginHealth.Healthy);
    expect(MarginHealth.classify(35.5)).toBe(MarginHealth.Healthy);
    expect(Simulator.classifyMarginHealth(20)).toBe(MarginHealth.Healthy);
  });

  it("classifies NPM% from 10 inclusive to below 20 as Warning", () => {
    expect(MarginHealth.classify(10)).toBe(MarginHealth.Warning);
    expect(MarginHealth.classify(19.999)).toBe(MarginHealth.Warning);
  });

  it("classifies NPM% below 10 as Risky", () => {
    expect(MarginHealth.classify(9.999)).toBe(MarginHealth.Risky);
    expect(MarginHealth.classify(-12)).toBe(MarginHealth.Risky);
  });

  it("is analytical only and recomputes directly from the latest NPM%", () => {
    const p = product({ hargaJual: 100_000, hpp: 60_000 });
    const r = rule({ discountPercent: 0 });

    const healthy = Simulator.simulate(p, r, costConfig({ adminFee: 10 }));
    const risky = Simulator.simulate(p, r, costConfig({ adminFee: 35 }));

    expect(healthy.npmPct).toBe(30);
    expect(risky.npmPct).toBe(5);
    expect(MarginHealth.classify(healthy.npmPct!)).toBe(MarginHealth.Healthy);
    expect(MarginHealth.classify(risky.npmPct!)).toBe(MarginHealth.Risky);
  });
});

describe("Simulator is pure", () => {
  it("does not mutate the product, rule, or cost config", () => {
    const p = product({ hargaJual: 100_000, hpp: 50_000 });
    const pSnapshot = { ...p };
    const r = rule({ discountPercent: 15 });
    const rSnapshot = { ...r };
    const cfg = costConfig({ adminFee: 8 });
    const cfgSnapshot = { ...cfg };

    Simulator.simulate(p, r, cfg);

    expect(p).toEqual(pSnapshot);
    expect(r).toEqual(rSnapshot);
    expect(cfg).toEqual(cfgSnapshot);
  });
});
