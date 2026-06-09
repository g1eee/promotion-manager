/**
 * Core domain types and value objects for the Promotion Management System (PMS).
 *
 * Framework-agnostic and pure: no I/O, no persistence, no UI concerns. These
 * shapes are the realization of the design's "Data Models" section and are kept
 * consistent with the concrete "Database Schema (Final)".
 *
 * Monetary fields (hpp, hargaJual) are represented as `number` (Rupiah). The
 * persistence layer stores them as Decimal/numeric(14,2); the domain treats
 * them as plain numbers for pure computation. Percentage fields (cost
 * components, discountPercent) are likewise `number`.
 */

import type {
  BenefitType,
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
} from "./enums";

/**
 * A single rule/benefit pattern stored inside a Promo_Template's `config`.
 * Mirrors the shape of a {@link Rule} without surrogate identity, since a
 * template is a reusable pattern rather than a concrete promo rule.
 */
export interface PromoTemplateRuleConfig {
  /** Minimum purchase quantity; must be >= 1 (validation in service layer). */
  minQuantity: number;
  benefitType: BenefitType;
  /** Discount percentage, present when benefitType is DiscountPercent. */
  discountPercent?: number | null;
  /** Free gift description, present when benefitType is FreeGift. */
  gift?: string | null;
}

/**
 * Structured payload describing a Promo_Template's rule/benefit pattern.
 * Persisted as `jsonb` (Database Schema: `promo_templates.config`).
 */
export interface PromoTemplateConfig {
  rules: PromoTemplateRuleConfig[];
}

/**
 * Promo_Template (Req 5): a ready-to-use promo pattern to accelerate promo
 * creation. Five built-in templates are seeded; an unlimited number of custom
 * templates may be created.
 */
export interface PromoTemplate {
  /** Surrogate identifier (PK). */
  readonly id: string;
  name: string;
  /** Promo type the template targets; null when type-agnostic. */
  promoType: PromoType | null;
  /** Rule/benefit pattern carried by the template. */
  config: PromoTemplateConfig;
  /** Whether this is a seeded built-in template (Req 5.1). */
  isBuiltIn: boolean;
  /** Creator user id; null for system-seeded built-in templates. */
  createdBy: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit fields attached to primary entities (Brand, Campaign, Promo_Scenario,
 * Product). `createdBy`/`createdAt` are immutable once set; `updatedAt` tracks
 * the last modification.
 */
export interface AuditFields {
  /** Identifier of the user that created the entity (references a User id). */
  readonly createdBy: string;
  /** Creation timestamp. */
  readonly createdAt: Date;
  /** Last modification timestamp. */
  updatedAt: Date;
}

/**
 * Value object identifying a product by its per-Brand identity `(brandId,
 * productId)`. Product identity is never the product name (Req 3.4).
 */
export interface ProductRef {
  /** Owning Brand surrogate id. */
  readonly brandId: string;
  /** Business Product ID, unique within the owning Brand. */
  readonly productId: string;
}

/**
 * Brand entity. Root of the data ownership hierarchy.
 */
export interface Brand extends AuditFields {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Business Brand ID, unique globally (Req 19.2). */
  brandId: string;
  brandName: string;
  displayName: string;
  status: BrandStatus;
}

/**
 * Product (Product_Master). Uniqueness is enforced solely on the combination
 * `(brandId, productId)`; the product name carries no uniqueness constraint.
 */
export interface Product extends AuditFields {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Owning Brand surrogate id (FK). Part of the uniqueness key. */
  readonly brandId: string;
  /** Business Product ID, unique within the owning Brand. */
  productId: string;
  /** Product name; no uniqueness constraint. */
  namaProduk: string;
  kategori: string;
  /** Harga Pokok Produksi in Rupiah. */
  hpp: number;
  /** Normal selling price in Rupiah. */
  hargaJual: number;
  status: ProductStatus;
}

/**
 * Cost_Configuration owned per Brand. All cost components are percentages in
 * the inclusive range 0–100 (range validation lives in the service layer).
 */
export interface CostConfiguration {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Owning Brand surrogate id (FK, unique per Brand). */
  readonly brandId: string;
  adminFee: number;
  shippingFee: number;
  promoXtra: number;
  feePesanan: number;
  campaignFee: number;
  promosiFee: number;
  marketingFee: number;
  adsSpending: number;
  affiliateCommission: number;
  operatingCost: number;
  /** Whether this set is the active configuration for the Brand. */
  isActive: boolean;
  /** Last modification timestamp. */
  updatedAt: Date;
}

/**
 * Campaign: container that holds one or more Promo_Scenario, owned by a Brand.
 */
export interface Campaign extends AuditFields {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Owning Brand surrogate id (FK). */
  readonly brandId: string;
  nama: string;
  tanggalMulai: Date;
  /** Must be on or after `tanggalMulai` (validation in service layer). */
  tanggalSelesai: Date;
  status: CampaignStatus;
}

/**
 * Rule: a minimum-quantity condition mapped to a benefit (discount % or free
 * gift). `discountPercent` is set when `benefitType` is DiscountPercent; `gift`
 * is set when `benefitType` is FreeGift.
 */
export interface Rule {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Minimum purchase quantity; must be >= 1 (validation in service layer). */
  minQuantity: number;
  benefitType: BenefitType;
  /** Discount percentage, present when benefitType is DiscountPercent. */
  discountPercent?: number | null;
  /** Free gift description, present when benefitType is FreeGift. */
  gift?: string | null;
}

/**
 * Promo_Scenario: a promo definition owned by a Brand and belonging to exactly
 * one Campaign. The promo Brand must be consistent with its Campaign's Brand
 * (enforced in the service layer).
 */
export interface PromoScenario extends AuditFields {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Owning Brand surrogate id (FK). Must equal the Campaign's brandId. */
  readonly brandId: string;
  /** Owning Campaign surrogate id (FK). Exactly one. */
  campaignId: string;
  namaPromo: string;
  promoType: PromoType;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  status: PromoStatus;
  /** Execution status; null until the promo is Approved. */
  executionStatus: ExecutionStatus | null;
  rules: Rule[];
  /** Referenced products by identity `(brandId, productId)`. */
  productRefs: ProductRef[];
}

/**
 * Feedback_Record: a structured, two-way discussion entry attached to a promo.
 * Any role with access to the promo may create one (Req 1.5).
 */
export interface FeedbackRecord {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Promo Reference (Promo_Scenario id). */
  readonly promoRef: string;
  message: string;
  /** Identifier of the user that created the feedback (references a User id). */
  readonly createdByUser: string;
  readonly createdDate: Date;
  /** User ids that have read this feedback (supports Unread Feedback, Req 2.6). */
  readBy?: string[];
}

/**
 * Approval_History entry: logs a promo status transition. Written in the same
 * transaction as the status change (Req 17.3).
 */
export interface ApprovalHistoryEntry {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Promo Reference (Promo_Scenario id). */
  readonly promoRef: string;
  status: PromoStatus;
  /** Identifier of the user that performed the change (references a User id). */
  readonly changedBy?: string | null;
  readonly changedAt: Date;
}

/**
 * Attachment (optional / nice-to-have): a supporting file uploaded to a promo.
 */
export interface Attachment {
  /** Surrogate identifier (PK). */
  readonly id: string;
  /** Promo Reference (Promo_Scenario id). */
  readonly promoRef: string;
  attachmentName: string;
  fileUrl: string;
  /** Identifier of the user that uploaded the file (references a User id). */
  readonly uploadedBy: string;
  readonly uploadDate: Date;
}
