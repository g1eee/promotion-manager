/**
 * Core domain enums for the Promotion Management System (PMS).
 *
 * Framework-agnostic and pure: these declarations carry no I/O or runtime
 * dependencies. String enum values intentionally mirror the canonical labels
 * used in the design's "Data Models" and "Database Schema (Final)" sections so
 * that domain values map 1:1 to the persisted enum values.
 */

/**
 * User role. Each account is associated with exactly one role (Req 1.1).
 */
export enum Role {
  SPV_Marketing = "SPV_Marketing",
  Admin_Marketplace = "Admin_Marketplace",
}

/**
 * Brand lifecycle status (Data Models: Brand).
 *
 * Included to type `Brand.status` consistently with the design schema
 * (`brand_status` {Active, Archived}).
 */
export enum BrandStatus {
  Active = "Active",
  Archived = "Archived",
}

/**
 * Product lifecycle status on Product_Master (Req 3.6).
 * - Active: selectable on new promos.
 * - Inactive: not selectable on new promos but visible in historical records.
 * - Archived: hidden from normal selection but retained for reporting/history.
 */
export enum ProductStatus {
  Active = "Active",
  Inactive = "Inactive",
  Archived = "Archived",
}

/**
 * Campaign status (Req 6.4).
 */
export enum CampaignStatus {
  Draft = "Draft",
  Active = "Active",
  Completed = "Completed",
  Archived = "Archived",
}

/**
 * Promo_Scenario status (Req 7.8).
 */
export enum PromoStatus {
  Draft = "Draft",
  Review = "Review",
  Approved = "Approved",
  Rejected = "Rejected",
  Active = "Active",
  Completed = "Completed",
}

/**
 * Promo type selected on Basic Information (Req 7.6).
 * Member values mirror the canonical labels used across the design.
 */
export enum PromoType {
  BuyXDiscount = "Buy X Discount",
  BuyXGetGift = "Buy X Get Gift",
  Voucher = "Voucher",
  FlashSale = "Flash Sale",
  BundlePromo = "Bundle Promo",
}

/**
 * Promo execution status (Req 18.1).
 */
export enum ExecutionStatus {
  Approved = "Approved",
  SentToAdmin = "Sent to Admin",
  MarketplaceSetup = "Marketplace Setup",
  Completed = "Completed",
}

/**
 * Margin Health / Profitability Indicator (Req 20.2).
 *
 * Analytical/decision-support only: derived from NPM% and never persisted as a
 * source of truth for approval, nor does it affect the approval process.
 */
export enum MarginHealth {
  Healthy = "Healthy",
  Warning = "Warning",
  Risky = "Risky",
}

const HEALTHY_NPM_THRESHOLD = 20;
const WARNING_NPM_THRESHOLD = 10;

// Enum/namespace merge intentionally attaches `classify` as a static helper on
// the `MarginHealth` enum so callers use `MarginHealth.classify(...)` alongside
// the enum members. This is the canonical TS pattern for enum statics.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MarginHealth {
  /**
   * Classify NPM% into the analytical Margin Health bands (Req 20.1-20.4).
   *
   * Boundary rules are inclusive at the lower edge of each stronger band:
   * - `npmPct >= 20` => Healthy
   * - `10 <= npmPct < 20` => Warning
   * - `npmPct < 10` => Risky
   */
  export function classify(npmPct: number): MarginHealth {
    if (npmPct >= HEALTHY_NPM_THRESHOLD) {
      return MarginHealth.Healthy;
    }
    if (npmPct >= WARNING_NPM_THRESHOLD) {
      return MarginHealth.Warning;
    }
    return MarginHealth.Risky;
  }
}

/**
 * Benefit type for a promo Rule (Req 23.1, Data Models: Rule).
 */
export enum BenefitType {
  DiscountPercent = "DiscountPercent",
  FreeGift = "FreeGift",
}
