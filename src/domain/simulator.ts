/**
 * Simulator — pure promo feasibility simulation (Req 11, supports Req 10, 4.4).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no service-layer
 * imports. Given a product, the promo Rule applied to it, and the Brand's
 * active {@link CostConfiguration}, this computes the seven per-product
 * Simulator outputs from immutable inputs without mutating its arguments. This
 * keeps the behaviour trivially unit- and property-testable.
 *
 * ## The seven outputs (Req 11.1)
 * For each product the Simulator produces:
 * 1. Harga Normal  — the product's normal selling price (`product.hargaJual`).
 * 2. Harga Promo   — the discounted promo price per pcs (Req 10.1), reusing
 *    {@link PromoCalculator.pricePerPcs}.
 * 3. Potongan      — `Harga Normal − Harga Promo` (Req 11.6).
 * 4. Margin (Rp)   — `Harga Promo − HPP` (Req 11.4). The sign is preserved; a
 *    negative margin is NOT clamped to zero (Req 11.5).
 * 5. Margin (%)    — `Margin Rp / Harga Promo × 100`.
 * 6. NPM (Rp)      — net profit in Rupiah after HPP and all ten cost components.
 * 7. NPM (%)       — `NPM Rp / Harga Promo × 100`.
 *
 * ## NPM basis (Req 11.2)
 * The ten Cost_Configuration components are percentages of Harga Promo. NPM in
 * Rupiah is the margin less the sum of those components applied to Harga Promo:
 *
 *   ΣcostPct = adminFee + shippingFee + promoXtra + feePesanan + campaignFee
 *            + promosiFee + marketingFee + adsSpending + affiliateCommission
 *            + operatingCost                                   (whole-number %)
 *
 *   NPM Rp = (Harga Promo − HPP) − (Harga Promo × ΣcostPct / 100)
 *          = Margin Rp − (Harga Promo × ΣcostPct / 100)
 *
 * This realizes the design's statement that NPM "memasukkan HPP produk dan
 * kesepuluh komponen Cost_Configuration aktif" (design "Promo Logic &
 * Simulator", Property 27). Like Margin, NPM is not clamped, so a loss-making
 * promo yields a negative NPM by design.
 *
 * ## Percentage division by Harga Promo === 0
 * Margin % and NPM % divide by Harga Promo. When Harga Promo is `0` (a full
 * 100% discount), the percentage is undefined; rather than emit `±Infinity` or
 * `NaN`, this module reports the percentage as `null`. The absolute Rupiah
 * figures (Margin Rp, NPM Rp) are still computed normally in that case.
 *
 * ## Deferred NPM (Req 11.7)
 * When the Brand's Cost_Configuration is not active (`costConfig.isActive ===
 * false`) or is unavailable (`null`/`undefined`), NPM is DEFERRED: both NPM Rp
 * and NPM % are reported as `null`. The other five outputs (Harga Normal,
 * Harga Promo, Potongan, Margin Rp, Margin %) are still produced. The presence
 * of the active cost basis used (Req 11.8 "Active Cost Configuration" /
 * Last Updated Date) and Margin Health classification (Req 20) are handled by
 * separate tasks and are intentionally out of scope here.
 */

import { PromoCalculator } from "./promo-calculator";
import type { CostConfiguration, Product, Rule } from "./types";

/** Percent values are whole numbers (e.g. `10` = 10%); divide by this. */
const PERCENT_DIVISOR = 100;

/**
 * The ten Cost_Configuration components, in canonical order (Req 11.2, 4.4).
 *
 * Declared locally to keep the domain layer free of service-layer imports; the
 * list mirrors the inline fields on {@link CostConfiguration}.
 */
export const COST_COMPONENT_KEYS = [
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
] as const satisfies ReadonlyArray<keyof CostConfiguration>;

/**
 * The seven per-product Simulator outputs (Req 11.1).
 *
 * Percentage fields are `number | null`: `null` signals the percentage is
 * undefined because Harga Promo is `0`. The NPM fields are additionally `null`
 * when NPM is deferred (Req 11.7).
 */
export interface SimulatedProduct {
  /** Product identity within its Brand (Req 9.10): `(brandId, productId)`. */
  readonly brandId: string;
  readonly productId: string;
  /** 1. Harga Normal: the product's normal selling price. */
  readonly hargaNormal: number;
  /** 2. Harga Promo: discounted promo price per pcs (Req 10.1). */
  readonly hargaPromo: number;
  /** 3. Potongan: `Harga Normal − Harga Promo` (Req 11.6). */
  readonly potongan: number;
  /** 4. Margin (Rp): `Harga Promo − HPP`, sign preserved (Req 11.4, 11.5). */
  readonly marginRp: number;
  /** 5. Margin (%): `Margin Rp / Harga Promo × 100`; `null` when Harga Promo is 0. */
  readonly marginPct: number | null;
  /** 6. NPM (Rp): net profit after HPP + 10 cost components; `null` when deferred (Req 11.7). */
  readonly npmRp: number | null;
  /** 7. NPM (%): `NPM Rp / Harga Promo × 100`; `null` when deferred or Harga Promo is 0. */
  readonly npmPct: number | null;
  /** Whether NPM was deferred because the Brand cost config is inactive/unavailable (Req 11.7). */
  readonly npmDeferred: boolean;
}

/**
 * Sum the ten Cost_Configuration components as a whole-number percent (Req 11.2).
 *
 * @param costConfig The Brand's active cost configuration (not mutated).
 * @returns ΣcostPct, the sum of the ten components (e.g. `35` = 35%).
 */
function sumCostComponents(costConfig: CostConfiguration): number {
  return COST_COMPONENT_KEYS.reduce((sum, key) => sum + costConfig[key], 0);
}

/**
 * Compute a percentage `value / hargaPromo × 100`, guarding division by zero.
 *
 * @param value The Rupiah numerator (e.g. Margin Rp or NPM Rp).
 * @param hargaPromo The Harga Promo denominator.
 * @returns The percentage, or `null` when `hargaPromo` is `0` (undefined).
 */
function pctOf(value: number, hargaPromo: number): number | null {
  if (hargaPromo === 0) {
    return null;
  }
  return (value / hargaPromo) * PERCENT_DIVISOR;
}

/**
 * Determine whether NPM must be deferred (Req 11.7).
 *
 * NPM is deferred when no cost configuration is supplied (`null`/`undefined`)
 * or when the supplied configuration is not active (`isActive === false`).
 *
 * @param costConfig The Brand's cost configuration, or `null`/`undefined`.
 * @returns `true` when NPM should be deferred.
 */
function isNpmDeferred(
  costConfig: CostConfiguration | null | undefined,
): costConfig is null | undefined | (CostConfiguration & { isActive: false }) {
  return costConfig == null || costConfig.isActive === false;
}

/**
 * Simulate the seven Simulator outputs for a single product (Req 11.1–11.7).
 *
 * The same promo {@link Rule} is applied here as for every other selected
 * product (Req 10.3); pricing reuses {@link PromoCalculator}. When the Brand's
 * `costConfig` is inactive or unavailable, NPM is deferred (`npmRp`/`npmPct`
 * are `null`, `npmDeferred` is `true`) while the other five outputs are still
 * produced (Req 11.7).
 *
 * @param product The product being simulated (not mutated).
 * @param rule The promo Rule applied to the product (not mutated).
 * @param costConfig The Brand's active cost configuration, or `null`/`undefined`
 *   when unavailable. Used only for NPM (Req 11.2, 4.4).
 * @returns The {@link SimulatedProduct} result.
 */
function simulate(
  product: Product,
  rule: Rule,
  costConfig: CostConfiguration | null | undefined,
): SimulatedProduct {
  const hargaNormal = product.hargaJual;
  const hargaPromo = PromoCalculator.pricePerPcs(
    product.hargaJual,
    PromoCalculator.discountPercentOf(rule),
  );
  const potongan = hargaNormal - hargaPromo;

  // Margin (Rp) preserves its sign; negatives are not clamped (Req 11.4, 11.5).
  const marginRp = hargaPromo - product.hpp;
  const marginPct = pctOf(marginRp, hargaPromo);

  if (isNpmDeferred(costConfig)) {
    // NPM deferred: the other five outputs are still produced (Req 11.7).
    return {
      brandId: product.brandId,
      productId: product.productId,
      hargaNormal,
      hargaPromo,
      potongan,
      marginRp,
      marginPct,
      npmRp: null,
      npmPct: null,
      npmDeferred: true,
    };
  }

  // NPM Rp = Margin Rp − (Harga Promo × ΣcostPct / 100) (Req 11.2).
  const costPct = sumCostComponents(costConfig);
  const npmRp = marginRp - hargaPromo * (costPct / PERCENT_DIVISOR);
  const npmPct = pctOf(npmRp, hargaPromo);

  return {
    brandId: product.brandId,
    productId: product.productId,
    hargaNormal,
    hargaPromo,
    potongan,
    marginRp,
    marginPct,
    npmRp,
    npmPct,
    npmDeferred: false,
  };
}

/**
 * Simulate the SAME Rule against every selected product (Req 10.3, 11.1),
 * returning a new array of results in input order. The input list is not
 * mutated.
 *
 * @param products The selected products (not mutated).
 * @param rule The single Rule applied to all products (not mutated).
 * @param costConfig The Brand's active cost configuration, or `null`/`undefined`.
 * @returns A new array of {@link SimulatedProduct} in the same order as `products`.
 */
function simulateAll(
  products: readonly Product[],
  rule: Rule,
  costConfig: CostConfiguration | null | undefined,
): SimulatedProduct[] {
  return products.map((product) => simulate(product, rule, costConfig));
}

/**
 * Pure promo Simulator operations (Req 11).
 */
export const Simulator = {
  /** Sum of the ten cost components as a whole-number percent (Req 11.2). */
  sumCostComponents,

  /** Simulate the seven outputs for one product (Req 11.1–11.7). */
  simulate,

  /** Apply the same Rule to all selected products (Req 10.3, 11.1). */
  simulateAll,
} as const;
