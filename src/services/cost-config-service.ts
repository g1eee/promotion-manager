/**
 * CostConfigService — Cost Configuration management, owned per Brand (Req 4).
 *
 * Responsibilities (design "Components and Interfaces → Cost Configuration"):
 * - `get(brandId)` returns the Brand's ten percentage cost components.
 * - `update(brandId, components)` validates every component is within the
 *   inclusive range 0–100 and rejects the entire update atomically if any
 *   component is out of range (Req 4.5 / Property 13). On success it persists
 *   the values as the Brand's active configuration (Req 4.3) without touching
 *   any other Brand's configuration (Req 4.2 / Property 12).
 *
 * The service depends only on repository ports (Dependency Inversion), so it
 * works against the in-memory adapter in tests and a database-backed adapter
 * later without code changes.
 */

import type { CostConfiguration } from "../domain";
import type {
  BrandRepository,
  CostConfigurationRepository,
} from "../persistence";
import { ForeignKeyError } from "../persistence";
import { ValidationError } from "./errors";

/**
 * The ten cost components stored per Brand, in canonical order
 * (Req 4.1, Data Models: Cost_Configuration).
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
] as const;

/** Union of the ten cost-component field names. */
export type CostComponentKey = (typeof COST_COMPONENT_KEYS)[number];

/** The ten percentage cost components (each 0–100). */
export type CostComponents = Record<CostComponentKey, number>;

/** Repository ports required by {@link CostConfigService}. */
export interface CostConfigServiceDeps {
  readonly costConfigs: CostConfigurationRepository;
  readonly brands: BrandRepository;
}

/** Inclusive lower/upper bounds for every cost component (percent). */
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

/** A brand-new, inactive configuration with all components at zero. */
function defaultComponents(): CostComponents {
  return {
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
  };
}

export class CostConfigService {
  constructor(private readonly deps: CostConfigServiceDeps) {}

  /**
   * Return the Brand's Cost_Configuration (the ten percentage components).
   *
   * If the Brand has not configured its costs yet, returns an inactive default
   * (all components 0, `isActive: false`) so callers always receive the full
   * set of components. An inactive configuration signals the Promo_Simulator to
   * defer NPM computation (Req 11.7).
   */
  async get(brandId: string): Promise<CostConfiguration> {
    const existing = await this.deps.costConfigs.findByBrandId(brandId);
    if (existing) return existing;
    return {
      id: "",
      brandId,
      ...defaultComponents(),
      isActive: false,
      updatedAt: new Date(0),
    };
  }

  /**
   * Validate and persist the Brand's cost components as its active
   * configuration.
   *
   * Validation is atomic (Req 4.5 / Property 13): every component is checked
   * against 0–100 *before* any write, so a single out-of-range value rejects
   * the whole update and leaves the stored configuration unchanged. Updating
   * one Brand never affects another Brand's configuration (Req 4.2 /
   * Property 12).
   *
   * @throws {ValidationError} when one or more components are outside 0–100, or
   *   are not finite numbers. The `fields` map names every offending component.
   * @throws {ForeignKeyError} when the Brand does not exist.
   */
  async update(
    brandId: string,
    components: CostComponents,
  ): Promise<CostConfiguration> {
    this.assertComponentsInRange(components);

    const existing = await this.deps.costConfigs.findByBrandId(brandId);
    const now = new Date();

    if (existing) {
      const updated: CostConfiguration = {
        ...existing,
        ...this.pickComponents(components),
        isActive: true,
        updatedAt: now,
      };
      return this.deps.costConfigs.update(updated);
    }

    // First-time configuration for this Brand: ensure the Brand exists so we
    // surface a clear foreign-key error instead of orphaning a config.
    const brand = await this.deps.brands.findById(brandId);
    if (!brand) {
      throw new ForeignKeyError("CostConfiguration", `Brand "${brandId}"`);
    }

    const created: CostConfiguration = {
      id: crypto.randomUUID(),
      brandId,
      ...this.pickComponents(components),
      isActive: true,
      updatedAt: now,
    };
    return this.deps.costConfigs.insert(created);
  }

  /**
   * Reject the entire update when any component is non-finite or outside the
   * inclusive 0–100 range. Throws before any mutation so the stored
   * configuration is left untouched (atomicity).
   */
  private assertComponentsInRange(components: CostComponents): void {
    const fields: Record<string, string> = {};
    for (const key of COST_COMPONENT_KEYS) {
      const value = components[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < MIN_PERCENT ||
        value > MAX_PERCENT
      ) {
        fields[key] = `Nilai harus berupa angka dalam rentang ${MIN_PERCENT}–${MAX_PERCENT} persen.`;
      }
    }
    if (Object.keys(fields).length > 0) {
      throw new ValidationError(
        "Komponen biaya harus berada dalam rentang 0–100 persen; seluruh perubahan ditolak.",
        fields,
      );
    }
  }

  /** Extract only the ten known component fields (ignores any extra keys). */
  private pickComponents(components: CostComponents): CostComponents {
    const picked = {} as CostComponents;
    for (const key of COST_COMPONENT_KEYS) {
      picked[key] = components[key];
    }
    return picked;
  }
}
