import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BenefitType } from "./enums";
import { PromoCalculator } from "./promo-calculator";
import type { Product, Rule } from "./types";

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

describe("PromoCalculator.pricePerPcs computes the discounted unit price (Req 10.1)", () => {
  it("subtracts the discounted amount: hargaJual - (hargaJual * pct/100)", () => {
    // 10% off 10_000 -> 10_000 - 1_000 = 9_000.
    expect(PromoCalculator.pricePerPcs(10_000, 10)).toBe(9_000);
  });

  it("returns hargaJual unchanged for a zero discount", () => {
    expect(PromoCalculator.pricePerPcs(10_000, 0)).toBe(10_000);
  });

  it("returns 0 for a full 100% discount", () => {
    expect(PromoCalculator.pricePerPcs(10_000, 100)).toBe(0);
  });

  it("does not clamp: a discount above 100% yields a negative price", () => {
    // 150% off 10_000 -> 10_000 - 15_000 = -5_000.
    expect(PromoCalculator.pricePerPcs(10_000, 150)).toBe(-5_000);
  });
});

describe("PromoCalculator.total computes price * quantity (Req 10.2)", () => {
  it("multiplies the unit price by the quantity", () => {
    expect(PromoCalculator.total(9_000, 3)).toBe(27_000);
  });

  it("returns 0 for a zero quantity", () => {
    expect(PromoCalculator.total(9_000, 0)).toBe(0);
  });
});

describe("PromoCalculator.discountPercentOf reads the Rule's discount", () => {
  it("returns the discountPercent of a DiscountPercent rule", () => {
    expect(PromoCalculator.discountPercentOf(rule({ discountPercent: 25 }))).toBe(
      25,
    );
  });

  it("treats a missing/null discountPercent as 0", () => {
    expect(
      PromoCalculator.discountPercentOf(rule({ discountPercent: null })),
    ).toBe(0);
  });

  it("returns 0 for a FreeGift rule (no price reduction)", () => {
    const gift = rule({
      benefitType: BenefitType.FreeGift,
      discountPercent: null,
      gift: "Tote bag",
    });
    expect(PromoCalculator.discountPercentOf(gift)).toBe(0);
  });
});

describe("PromoCalculator.priceProduct prices one product under a Rule (Req 10.1, 10.2)", () => {
  it("combines pricePerPcs and total for the product", () => {
    const p = product({ hargaJual: 20_000 });
    const r = rule({ discountPercent: 10 });

    const priced = PromoCalculator.priceProduct(p, r, 4);

    expect(priced.brandId).toBe(p.brandId);
    expect(priced.productId).toBe(p.productId);
    expect(priced.hargaJual).toBe(20_000);
    expect(priced.pricePerPcs).toBe(18_000); // 10% off 20_000
    expect(priced.total).toBe(72_000); // 18_000 * 4
  });

  it("leaves the price at hargaJual for a FreeGift rule", () => {
    const p = product({ hargaJual: 15_000 });
    const gift = rule({ benefitType: BenefitType.FreeGift, discountPercent: null });

    const priced = PromoCalculator.priceProduct(p, gift, 2);

    expect(priced.pricePerPcs).toBe(15_000);
    expect(priced.total).toBe(30_000);
  });
});

describe("PromoCalculator.priceProducts applies the SAME Rule to all products (Req 10.3)", () => {
  it("prices every product with the same discount percent", () => {
    const products = [
      product({ hargaJual: 10_000 }),
      product({ hargaJual: 20_000 }),
      product({ hargaJual: 5_000 }),
    ];
    const r = rule({ discountPercent: 20 });

    const priced = PromoCalculator.priceProducts(products, r, 1);

    expect(priced.map((x) => x.pricePerPcs)).toEqual([8_000, 16_000, 4_000]);
    // Every result reflects exactly the same discount fraction (20%).
    for (const result of priced) {
      const expectedFraction = 1 - 20 / 100;
      expect(result.pricePerPcs).toBeCloseTo(result.hargaJual * expectedFraction);
    }
  });

  it("preserves input order and length", () => {
    const products = [
      product({ productId: "A" }),
      product({ productId: "B" }),
      product({ productId: "C" }),
    ];

    const priced = PromoCalculator.priceProducts(products, rule(), 1);

    expect(priced.map((x) => x.productId)).toEqual(["A", "B", "C"]);
  });

  it("returns an empty array for no products", () => {
    expect(PromoCalculator.priceProducts([], rule(), 5)).toEqual([]);
  });
});

describe("PromoCalculator is pure", () => {
  it("does not mutate the product list, products, or rule", () => {
    const p1 = product({ hargaJual: 10_000 });
    const p2 = product({ hargaJual: 20_000 });
    const products = [p1, p2];
    const productsSnapshot = [...products];
    const p1Snapshot = { ...p1 };
    const r = rule({ discountPercent: 15 });
    const ruleSnapshot = { ...r };

    PromoCalculator.priceProducts(products, r, 3);

    expect(products).toEqual(productsSnapshot);
    expect(products[0]).toBe(p1);
    expect(p1).toEqual(p1Snapshot);
    expect(r).toEqual(ruleSnapshot);
  });
});

describe("PromoCalculator arithmetic properties (Req 10.1, 10.2, 10.3)", () => {
  it("pricePerPcs equals hargaJual - (hargaJual * pct/100)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (hargaJual, discountPercent) => {
          const expected = hargaJual - hargaJual * (discountPercent / 100);
          expect(PromoCalculator.pricePerPcs(hargaJual, discountPercent)).toBe(
            expected,
          );
        },
      ),
    );
  });

  it("total equals pricePerPcs * qty", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }),
        fc.integer({ min: 0, max: 100_000 }),
        (unit, qty) => {
          expect(PromoCalculator.total(unit, qty)).toBe(unit * qty);
        },
      ),
    );
  });

  it("the same Rule applies an identical discount fraction to all products", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1_000_000, noNaN: true }), {
          minLength: 1,
          maxLength: 20,
        }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 1_000 }),
        (hargaJuals, discountPercent, qty) => {
          const products = hargaJuals.map((hargaJual) => product({ hargaJual }));
          const r = rule({ discountPercent });

          const priced = PromoCalculator.priceProducts(products, r, qty);

          expect(priced).toHaveLength(products.length);
          priced.forEach((result, index) => {
            const unit = PromoCalculator.pricePerPcs(
              hargaJuals[index]!,
              discountPercent,
            );
            expect(result.pricePerPcs).toBe(unit);
            expect(result.total).toBe(unit * qty);
          });
        },
      ),
    );
  });
});
