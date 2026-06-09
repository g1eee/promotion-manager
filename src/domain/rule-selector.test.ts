import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BenefitType } from "./enums";
import { RuleSelector } from "./rule-selector";
import type { Rule } from "./types";

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

describe("RuleSelector.select chooses the highest satisfied minQuantity (Req 8.5)", () => {
  it("selects the rule with the largest minQuantity that is <= quantity", () => {
    const r1 = rule({ id: "r1", minQuantity: 1 });
    const r5 = rule({ id: "r5", minQuantity: 5 });
    const r10 = rule({ id: "r10", minQuantity: 10 });

    // quantity 7 satisfies r1 (1) and r5 (5) but not r10 (10) -> r5 wins.
    expect(RuleSelector.select([r1, r5, r10], 7)).toBe(r5);
  });

  it("ignores rules whose minQuantity exceeds the quantity", () => {
    const r5 = rule({ id: "r5", minQuantity: 5 });
    const r10 = rule({ id: "r10", minQuantity: 10 });

    expect(RuleSelector.select([r5, r10], 9)).toBe(r5);
  });

  it("selects independently of input order", () => {
    const r1 = rule({ id: "r1", minQuantity: 1 });
    const r5 = rule({ id: "r5", minQuantity: 5 });
    const r10 = rule({ id: "r10", minQuantity: 10 });

    expect(RuleSelector.select([r10, r1, r5], 12)).toBe(r10);
    expect(RuleSelector.select([r5, r10, r1], 12)).toBe(r10);
  });
});

describe("RuleSelector.select returns null when nothing is satisfied (Req 8.5)", () => {
  it("returns null when quantity is below every rule's minQuantity", () => {
    const r5 = rule({ id: "r5", minQuantity: 5 });
    const r10 = rule({ id: "r10", minQuantity: 10 });

    expect(RuleSelector.select([r5, r10], 4)).toBeNull();
  });

  it("returns null for an empty rule list", () => {
    expect(RuleSelector.select([], 100)).toBeNull();
  });
});

describe("RuleSelector.select single-rule cases (Req 8.5)", () => {
  it("selects the only rule when its minQuantity is satisfied", () => {
    const only = rule({ id: "only", minQuantity: 3 });
    expect(RuleSelector.select([only], 3)).toBe(only);
    expect(RuleSelector.select([only], 100)).toBe(only);
  });

  it("returns null for the only rule when its minQuantity is not satisfied", () => {
    const only = rule({ id: "only", minQuantity: 3 });
    expect(RuleSelector.select([only], 2)).toBeNull();
  });
});

describe("RuleSelector.select boundary behaviour (Req 8.5)", () => {
  it("applies a rule when quantity exactly equals its minQuantity", () => {
    const r5 = rule({ id: "r5", minQuantity: 5 });
    expect(RuleSelector.select([r5], 5)).toBe(r5);
  });

  it("prefers a rule whose minQuantity exactly equals the quantity over lower ones", () => {
    const r1 = rule({ id: "r1", minQuantity: 1 });
    const r5 = rule({ id: "r5", minQuantity: 5 });
    expect(RuleSelector.select([r1, r5], 5)).toBe(r5);
  });

  it("resolves ties on the highest satisfied minQuantity to the first in order", () => {
    const first = rule({ id: "first", minQuantity: 5 });
    const second = rule({ id: "second", minQuantity: 5 });
    expect(RuleSelector.select([first, second], 9)).toBe(first);
  });
});

describe("RuleSelector.select is pure", () => {
  it("does not mutate or reorder the input rule list", () => {
    const r1 = rule({ id: "r1", minQuantity: 1 });
    const r5 = rule({ id: "r5", minQuantity: 5 });
    const input = [r1, r5];
    const snapshot = [...input];

    RuleSelector.select(input, 10);

    expect(input).toEqual(snapshot);
    expect(input[0]).toBe(r1);
    expect(input[1]).toBe(r5);
  });
});

describe("RuleSelector.select properties (Property 20, Req 8.5)", () => {
  it("the selected rule has the largest satisfied minQuantity; null iff none satisfied", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), {
          minLength: 0,
          maxLength: 30,
        }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (minQuantities, quantity) => {
          const rules = minQuantities.map((minQuantity, index) =>
            rule({ id: `prop-${index}`, minQuantity }),
          );

          const selected = RuleSelector.select(rules, quantity);
          const satisfied = minQuantities.filter((m) => m <= quantity);

          if (satisfied.length === 0) {
            expect(selected).toBeNull();
          } else {
            expect(selected).not.toBeNull();
            // The selected rule's minQuantity is the maximum satisfied one.
            expect(selected!.minQuantity).toBe(Math.max(...satisfied));
            // The selected rule is itself satisfied.
            expect(selected!.minQuantity).toBeLessThanOrEqual(quantity);
            // The selected rule is a member of the input.
            expect(rules).toContain(selected!);
          }
        },
      ),
    );
  });

  it("never selects a rule whose minQuantity exceeds the quantity", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { maxLength: 30 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (minQuantities, quantity) => {
          const rules = minQuantities.map((minQuantity, index) =>
            rule({ id: `prop-${index}`, minQuantity }),
          );
          const selected = RuleSelector.select(rules, quantity);
          if (selected !== null) {
            expect(selected.minQuantity).toBeLessThanOrEqual(quantity);
          }
        },
      ),
    );
  });
});
