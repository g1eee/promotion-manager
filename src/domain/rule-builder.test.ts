import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BenefitType, PromoStatus, PromoType } from "./enums";
import {
  MIN_RULE_QUANTITY,
  RuleBuilder,
  RuleValidationError,
} from "./rule-builder";
import type { PromoScenario, Rule } from "./types";

let ruleSeq = 0;

/** Build a Rule, defaulting to a valid discount-percent benefit (Req 8.1). */
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

/** Build an empty Draft promo to act on. */
function promo(overrides: Partial<PromoScenario> = {}): PromoScenario {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id: "promo-1",
    brandId: "brand-1",
    campaignId: "campaign-1",
    namaPromo: "Promo Test",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: now,
    tanggalSelesai: now,
    status: PromoStatus.Draft,
    executionStatus: null,
    rules: [],
    productRefs: [],
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("RuleBuilder.addRule (Req 8.1)", () => {
  it("adds a discount-percent Rule with min qty >= 1", () => {
    const discountRule = rule({
      minQuantity: 3,
      benefitType: BenefitType.DiscountPercent,
      discountPercent: 15,
      gift: null,
    });

    const next = RuleBuilder.addRule(promo(), discountRule);

    expect(next.rules).toEqual([discountRule]);
  });

  it("adds a free-gift Rule with min qty >= 1", () => {
    const giftRule = rule({
      minQuantity: 2,
      benefitType: BenefitType.FreeGift,
      discountPercent: null,
      gift: "Tote bag",
    });

    const next = RuleBuilder.addRule(promo(), giftRule);

    expect(next.rules).toEqual([giftRule]);
  });

  it("accepts the boundary minimum quantity of exactly 1", () => {
    const next = RuleBuilder.addRule(promo(), rule({ minQuantity: 1 }));
    expect(next.rules).toHaveLength(1);
    expect(MIN_RULE_QUANTITY).toBe(1);
  });

  it("does not mutate the input promo (pure)", () => {
    const original = promo();
    const next = RuleBuilder.addRule(original, rule());

    expect(original.rules).toEqual([]);
    expect(next).not.toBe(original);
    expect(next.rules).not.toBe(original.rules);
  });
});

describe("RuleBuilder.addRule rejects min qty < 1 (Req 8.3)", () => {
  it("throws RuleValidationError for min qty of 0", () => {
    expect(() => RuleBuilder.addRule(promo(), rule({ minQuantity: 0 }))).toThrow(
      RuleValidationError,
    );
  });

  it("throws RuleValidationError for negative min qty", () => {
    try {
      RuleBuilder.addRule(promo(), rule({ minQuantity: -5 }));
      expect.unreachable("expected RuleValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(RuleValidationError);
      expect((error as RuleValidationError).fields.minQuantity).toBeDefined();
    }
  });

  it("throws RuleValidationError for NaN/Infinity min qty", () => {
    expect(() =>
      RuleBuilder.addRule(promo(), rule({ minQuantity: Number.NaN })),
    ).toThrow(RuleValidationError);
    expect(() =>
      RuleBuilder.addRule(promo(), rule({ minQuantity: Number.POSITIVE_INFINITY })),
    ).toThrow(RuleValidationError);
  });

  it("leaves the promo unchanged when a Rule is rejected", () => {
    const original = promo();
    expect(() =>
      RuleBuilder.addRule(original, rule({ minQuantity: 0 })),
    ).toThrow(RuleValidationError);
    expect(original.rules).toEqual([]);
  });
});

describe("RuleBuilder allows unlimited Rules (Req 8.2)", () => {
  it("adds many Rules to a single promo", () => {
    let current = promo();
    const count = 250;
    for (let i = 0; i < count; i += 1) {
      current = RuleBuilder.addRule(current, rule({ minQuantity: i + 1 }));
    }
    expect(current.rules).toHaveLength(count);
  });
});

describe("RuleBuilder.removeRule (Req 8.4)", () => {
  it("removes the Rule with the matching id", () => {
    const keep = rule({ id: "keep" });
    const drop = rule({ id: "drop" });
    const withRules = promo({ rules: [keep, drop] });

    const next = RuleBuilder.removeRule(withRules, "drop");

    expect(next.rules).toEqual([keep]);
  });

  it("is a no-op when the id is not present", () => {
    const a = rule({ id: "a" });
    const withRules = promo({ rules: [a] });

    const next = RuleBuilder.removeRule(withRules, "missing");

    expect(next.rules).toEqual([a]);
  });

  it("does not mutate the input promo (pure)", () => {
    const a = rule({ id: "a" });
    const original = promo({ rules: [a] });

    const next = RuleBuilder.removeRule(original, "a");

    expect(original.rules).toEqual([a]);
    expect(next.rules).toEqual([]);
    expect(next).not.toBe(original);
  });
});

describe("RuleBuilder properties", () => {
  it("adding any number of valid Rules preserves count and order (Req 8.1, 8.2)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            minQuantity: fc.integer({ min: 1, max: 1_000_000 }),
            benefitType: fc.constantFrom(
              BenefitType.DiscountPercent,
              BenefitType.FreeGift,
            ),
          }),
        ),
        (specs) => {
          let current = promo();
          const added: Rule[] = [];
          specs.forEach((spec, index) => {
            const r = rule({
              id: `prop-${index}`,
              minQuantity: spec.minQuantity,
              benefitType: spec.benefitType,
            });
            added.push(r);
            current = RuleBuilder.addRule(current, r);
          });
          expect(current.rules).toEqual(added);
        },
      ),
    );
  });

  it("any min qty < 1 is always rejected (Req 8.3)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1_000_000, max: 0 }),
          fc.double({ min: -1000, max: 0.999, noNaN: true }),
        ),
        (minQuantity) => {
          expect(() =>
            RuleBuilder.addRule(promo(), rule({ minQuantity })),
          ).toThrow(RuleValidationError);
        },
      ),
    );
  });

  it("removing an added Rule by id restores the prior rule set (Req 8.4)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1 }),
        (existingIds, newId) => {
          fc.pre(!existingIds.includes(newId));
          const baseRules = existingIds.map((id, i) =>
            rule({ id: `${id}-${i}` }),
          );
          const start = promo({ rules: baseRules });
          const added = RuleBuilder.addRule(start, rule({ id: newId }));
          const removed = RuleBuilder.removeRule(added, newId);
          expect(removed.rules.map((r) => r.id)).toEqual(
            baseRules.map((r) => r.id),
          );
        },
      ),
    );
  });
});
