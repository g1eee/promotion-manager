/**
 * RuleSelector — pure domain logic for applying the correct promo Rule to a
 * given purchase quantity (Req 8.5, Property 20).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no UI concerns. The
 * single operation here inspects an immutable list of {@link Rule}s and
 * returns the Rule that should be applied for a purchase quantity, without
 * mutating its inputs. This keeps the behaviour trivially unit- and
 * property-testable.
 *
 * Selection rule (Req 8.5):
 * - When several Rules apply to a purchase quantity, the applied Rule is the
 *   one with the *largest* `minQuantity` that is still `<= quantity` (the
 *   highest satisfied minimum quantity).
 * - When no Rule's `minQuantity` is satisfied (the purchase quantity is below
 *   every Rule's `minQuantity`), no Rule is applied and `null` is returned.
 */

import type { Rule } from "./types";

/**
 * Select the Rule to apply for a given purchase quantity (Req 8.5).
 *
 * Among the Rules whose `minQuantity` is satisfied (`minQuantity <= quantity`),
 * the one with the highest `minQuantity` is chosen. If no Rule is satisfied
 * — including when `rules` is empty — `null` is returned, meaning no Rule is
 * applied.
 *
 * Rules with a non-finite `minQuantity` (`NaN`/`Infinity`) are never selected,
 * since such values are not usable purchase thresholds (consistent with
 * {@link RuleBuilder} validation). Ties on the highest satisfied `minQuantity`
 * resolve to the first such Rule in input order, which keeps selection
 * deterministic.
 *
 * The input list is not mutated.
 *
 * @param rules The candidate Rules (not mutated).
 * @param quantity The purchase quantity to evaluate.
 * @returns The Rule with the highest satisfied minimum quantity, or `null`
 *   when no Rule's minimum quantity is satisfied.
 */
function select(rules: readonly Rule[], quantity: number): Rule | null {
  let selected: Rule | null = null;

  for (const rule of rules) {
    const { minQuantity } = rule;
    if (!Number.isFinite(minQuantity) || minQuantity > quantity) {
      continue;
    }
    if (selected === null || minQuantity > selected.minQuantity) {
      selected = rule;
    }
  }

  return selected;
}

/**
 * Pure Rule selection for a purchase quantity (Req 8.5, Property 20).
 */
export const RuleSelector = {
  /**
   * Select the Rule with the highest satisfied minimum quantity for a purchase
   * quantity, or `null` when none is satisfied (Req 8.5).
   */
  select,
} as const;
