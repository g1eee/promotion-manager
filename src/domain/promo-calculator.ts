/**
 * PromoCalculator — pure promo pricing logic (Req 10).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no UI concerns. These
 * helpers compute the discounted unit price and order total from immutable
 * inputs and never mutate their arguments, which keeps the behaviour trivially
 * unit- and property-testable.
 *
 * Covered acceptance criteria:
 * - Req 10.1: the promo price per pcs is `Harga_Jual − (Harga_Jual × diskon)`
 *   (selling price minus the discounted amount).
 * - Req 10.2: the total price is `Harga Promo per pcs × quantity`.
 * - Req 10.3: the SAME Rule is applied to every selected product.
 *
 * ## Percentage convention
 * A {@link Rule}'s `discountPercent` is a *whole-number percent* (e.g. `10`
 * means 10%), consistent with how Rules are built and stored elsewhere in the
 * domain. The design formula `hargaJual − (hargaJual × discountPct)` is stated
 * in terms of a *fraction* (`0.1`). These two are reconciled here by dividing
 * the whole-number percent by 100 internally, so:
 *
 *   pricePerPcs = hargaJual − (hargaJual × (discountPercent / 100))
 *               = hargaJual × (1 − discountPercent / 100)
 *
 * Note this is intentionally *not* clamped: a `discountPercent` greater than
 * 100 yields a negative price, and a negative margin is preserved. Clamping and
 * margin-health concerns belong to the Simulator (a separate task) and are out
 * of scope here.
 */

import { BenefitType } from "./enums";
import type { Product, Rule } from "./types";

/** Percent values are whole numbers (e.g. `10` = 10%); divide by this. */
const PERCENT_DIVISOR = 100;

/**
 * Compute the discounted promo price per pcs (Req 10.1).
 *
 * `discountPercent` is a whole-number percent (e.g. `10` for 10%). The result
 * is `hargaJual − (hargaJual × discountPercent / 100)`, equivalently
 * `hargaJual × (1 − discountPercent / 100)`. A zero discount returns
 * `hargaJual` unchanged. The value is not clamped, so discounts above 100% can
 * produce a negative price by design (see module note).
 *
 * @param hargaJual Normal selling price in Rupiah.
 * @param discountPercent Discount as a whole-number percent (e.g. `10` = 10%).
 * @returns The discounted unit price in Rupiah.
 */
function pricePerPcs(hargaJual: number, discountPercent: number): number {
  return hargaJual - hargaJual * (discountPercent / PERCENT_DIVISOR);
}

/**
 * Compute the total order price (Req 10.2): `pricePerPcs × qty`.
 *
 * @param pricePerPcs The discounted unit price in Rupiah.
 * @param qty The purchase quantity.
 * @returns The total price in Rupiah.
 */
function total(pricePerPcs: number, qty: number): number {
  return pricePerPcs * qty;
}

/**
 * The effective discount percent carried by a Rule, as a whole-number percent.
 *
 * A {@link BenefitType.DiscountPercent} Rule contributes its `discountPercent`
 * (treating a missing/null value as `0`). A {@link BenefitType.FreeGift} Rule
 * carries no price reduction, so it contributes `0` and leaves the price at
 * `hargaJual`.
 *
 * @param rule The Rule to read the discount from (not mutated).
 * @returns The discount as a whole-number percent (e.g. `10` = 10%).
 */
function discountPercentOf(rule: Rule): number {
  if (rule.benefitType === BenefitType.DiscountPercent) {
    return rule.discountPercent ?? 0;
  }
  return 0;
}

/**
 * The priced result of applying a Rule to a single product at a quantity.
 */
export interface PricedProduct {
  /** Product identity within its Brand (Req 9.10): `(brandId, productId)`. */
  readonly brandId: string;
  readonly productId: string;
  /** Normal selling price in Rupiah. */
  readonly hargaJual: number;
  /** Discounted promo price per pcs (Req 10.1). */
  readonly pricePerPcs: number;
  /** Total price for `qty` units (Req 10.2). */
  readonly total: number;
}

/**
 * Price a single product under a Rule at a purchase quantity (Req 10.1, 10.2).
 *
 * @param product The product whose `hargaJual` is discounted (not mutated).
 * @param rule The Rule supplying the discount (not mutated).
 * @param qty The purchase quantity.
 * @returns The discounted unit price and total for the product.
 */
function priceProduct(product: Product, rule: Rule, qty: number): PricedProduct {
  const unit = pricePerPcs(product.hargaJual, discountPercentOf(rule));
  return {
    brandId: product.brandId,
    productId: product.productId,
    hargaJual: product.hargaJual,
    pricePerPcs: unit,
    total: total(unit, qty),
  };
}

/**
 * Apply the SAME Rule to every selected product at a purchase quantity
 * (Req 10.3), returning a new array of priced results in input order.
 *
 * Each product is priced independently from its own `hargaJual` using the
 * single shared Rule, so the discount percent applied is identical across all
 * products. The input list is not mutated.
 *
 * @param products The selected products (not mutated).
 * @param rule The single Rule applied to all products (not mutated).
 * @param qty The purchase quantity.
 * @returns A new array of {@link PricedProduct} in the same order as `products`.
 */
function priceProducts(
  products: readonly Product[],
  rule: Rule,
  qty: number,
): PricedProduct[] {
  return products.map((product) => priceProduct(product, rule, qty));
}

/**
 * Pure promo pricing operations (Req 10).
 */
export const PromoCalculator = {
  /** Discounted promo price per pcs (Req 10.1). */
  pricePerPcs,

  /** Total order price: `pricePerPcs × qty` (Req 10.2). */
  total,

  /** Effective whole-number discount percent carried by a Rule. */
  discountPercentOf,

  /** Price a single product under a Rule at a quantity (Req 10.1, 10.2). */
  priceProduct,

  /** Apply the same Rule to all selected products (Req 10.3). */
  priceProducts,
} as const;
