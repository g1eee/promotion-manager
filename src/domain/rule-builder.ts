/**
 * RuleBuilder — pure domain logic for the Dynamic Rule Builder (Req 8).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no UI concerns. These
 * helpers operate on immutable snapshots of a {@link PromoScenario}'s rule
 * list and always return a *new* `Rule[]` (or a new `PromoScenario`) rather
 * than mutating their inputs, which keeps the behaviour trivially unit- and
 * property-testable.
 *
 * Validation here is intentionally kept in the domain layer (rather than
 * importing the service-layer `ValidationError`) so the domain does not depend
 * on the service layer. Invalid input raises a {@link RuleValidationError},
 * which the service/API layers may translate into their own response shape.
 *
 * Covered acceptance criteria:
 * - Req 8.1: add a Rule carrying a minimum quantity and a benefit (discount
 *   percent or free gift).
 * - Req 8.2: an unlimited number of Rules may be added to a single promo.
 * - Req 8.3: a Rule whose minimum quantity is less than 1 is rejected with a
 *   validation message.
 * - Req 8.4: a Rule may be removed from the promo.
 */

import type { PromoScenario, Rule } from "./types";

/**
 * Deterministic, domain-level validation failure raised by {@link RuleBuilder}
 * when a Rule violates an acceptance criterion (e.g. minimum quantity < 1).
 *
 * Kept distinct from the service-layer `ValidationError` so the domain remains
 * dependency-free; callers in the service layer may catch and re-map it.
 */
export class RuleValidationError extends Error {
  /** Optional per-field messages, e.g. `{ minQuantity: "..." }`. */
  readonly fields: Readonly<Record<string, string>>;

  constructor(message: string, fields: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = "RuleValidationError";
    this.fields = fields;
  }
}

/** Smallest minimum quantity a Rule may carry (Req 8.3). */
export const MIN_RULE_QUANTITY = 1;

/**
 * Validate a Rule's `minQuantity`. A valid value is a finite number that is
 * greater than or equal to {@link MIN_RULE_QUANTITY} (Req 8.3). `NaN` and
 * `Infinity` are rejected because they are not usable purchase thresholds.
 *
 * @throws {RuleValidationError} when the minimum quantity is invalid.
 */
function assertValidMinQuantity(minQuantity: number): void {
  if (!Number.isFinite(minQuantity) || minQuantity < MIN_RULE_QUANTITY) {
    throw new RuleValidationError(
      "Minimum quantity Rule harus bernilai minimal 1.",
      {
        minQuantity: `Minimum quantity harus >= ${MIN_RULE_QUANTITY}.`,
      },
    );
  }
}

/**
 * Append a Rule to a list of Rules, returning a new array (Req 8.1, 8.2).
 *
 * The minimum quantity is validated up-front (Req 8.3). No upper bound is
 * imposed on the number of Rules, so an unlimited number may be added.
 *
 * @param rules The current Rules (not mutated).
 * @param rule The Rule to add; its `minQuantity` must be >= 1.
 * @returns A new array containing every existing Rule followed by `rule`.
 * @throws {RuleValidationError} when `rule.minQuantity` < 1.
 */
function addRuleToList(rules: readonly Rule[], rule: Rule): Rule[] {
  assertValidMinQuantity(rule.minQuantity);
  return [...rules, rule];
}

/**
 * Remove the Rule with the given id from a list of Rules, returning a new
 * array (Req 8.4). Removing an id that is not present is a no-op that returns
 * a copy of the original list.
 *
 * @param rules The current Rules (not mutated).
 * @param ruleId The surrogate id of the Rule to remove.
 * @returns A new array without the matching Rule.
 */
function removeRuleFromList(rules: readonly Rule[], ruleId: string): Rule[] {
  return rules.filter((rule) => rule.id !== ruleId);
}

/**
 * Pure Dynamic Rule Builder operations over a {@link PromoScenario}'s rules.
 *
 * Every operation returns a new `PromoScenario` (with a new `rules` array)
 * and leaves the input promo untouched.
 */
export const RuleBuilder = {
  /**
   * Add a Rule to a promo (Req 8.1, 8.2). Validates the minimum quantity
   * (Req 8.3) and allows an unlimited number of Rules.
   *
   * @throws {RuleValidationError} when `rule.minQuantity` < 1.
   */
  addRule(promo: PromoScenario, rule: Rule): PromoScenario {
    return { ...promo, rules: addRuleToList(promo.rules, rule) };
  },

  /**
   * Remove a Rule from a promo by its id (Req 8.4).
   */
  removeRule(promo: PromoScenario, ruleId: string): PromoScenario {
    return { ...promo, rules: removeRuleFromList(promo.rules, ruleId) };
  },

  /** Lower-level helper: add a Rule to a bare Rule list (Req 8.1, 8.2). */
  addRuleToList,

  /** Lower-level helper: remove a Rule from a bare Rule list (Req 8.4). */
  removeRuleFromList,
} as const;
