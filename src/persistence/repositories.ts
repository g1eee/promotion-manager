/**
 * Repository ports (framework-agnostic interfaces) for the PMS persistence
 * layer.
 *
 * These interfaces define the contract between the Domain/Service layer and any
 * concrete persistence adapter. Services depend only on these ports and are
 * injected with an implementation — the in-memory adapter for tests, or a
 * Prisma adapter later — without changing service code (Dependency Inversion).
 *
 * All methods are asynchronous (`Promise`-returning) so a database-backed
 * adapter (Prisma) is a drop-in replacement. The in-memory adapter resolves
 * synchronously under the hood.
 *
 * Relational integrity (FK ownership by Brand, `UNIQUE(brandId, productId)`,
 * referential delete protection) is enforced by the adapter and surfaced via
 * the typed errors in {@link ./errors}.
 */

import type {
  ApprovalHistoryEntry,
  Attachment,
  Brand,
  Campaign,
  CostConfiguration,
  ExecutionStatus,
  FeedbackRecord,
  Product,
  ProductRef,
  PromoScenario,
  PromoTemplate,
} from "../domain";
import type {
  BrandStatus,
  ProductStatus,
  PromoStatus,
} from "../domain";

/** Brand repository (root of the ownership hierarchy, Req 19). */
export interface BrandRepository {
  findById(id: string): Promise<Brand | null>;
  /** Find by the globally-unique business Brand ID (Req 19.2). */
  findByBrandId(brandId: string): Promise<Brand | null>;
  list(filter?: { status?: BrandStatus }): Promise<Brand[]>;
  /** Insert; rejects a duplicate `brandId` with {@link UniqueConstraintError}. */
  insert(brand: Brand): Promise<Brand>;
  update(brand: Brand): Promise<Brand>;
  /**
   * Delete; rejects with {@link ReferentialIntegrityError} when the Brand still
   * owns any Product, Campaign, or Promo_Scenario (Req 19.6).
   */
  delete(id: string): Promise<void>;
}

/** Product (Product_Master) repository (Req 3). */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  /** Resolve a product by its `(brandId, productId)` identity (Req 3.4). */
  findByRef(ref: ProductRef): Promise<Product | null>;
  /** All products sharing a business Product ID across Brands (Req 3.3). */
  findByProductId(productId: string): Promise<Product[]>;
  list(filter?: { brandId?: string; status?: ProductStatus }): Promise<Product[]>;
  /** Insert; enforces FK Brand existence and `UNIQUE(brandId, productId)`. */
  insert(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  /**
   * Delete; rejects with {@link ReferentialIntegrityError} when the product is
   * referenced by any Promo_Scenario (Req 3.10 — archive instead).
   */
  delete(id: string): Promise<void>;
}

/** Cost_Configuration repository, one active set per Brand (Req 4). */
export interface CostConfigurationRepository {
  findById(id: string): Promise<CostConfiguration | null>;
  /** Resolve the Cost_Configuration owned by a Brand (`UNIQUE(brandId)`). */
  findByBrandId(brandId: string): Promise<CostConfiguration | null>;
  /** Insert; enforces FK Brand existence and `UNIQUE(brandId)`. */
  insert(config: CostConfiguration): Promise<CostConfiguration>;
  update(config: CostConfiguration): Promise<CostConfiguration>;
}

/** Campaign repository (Req 6). */
export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  list(filter?: { brandId?: string }): Promise<Campaign[]>;
  /** Insert; enforces FK Brand existence. */
  insert(campaign: Campaign): Promise<Campaign>;
  update(campaign: Campaign): Promise<Campaign>;
  /**
   * Delete; rejects with {@link ReferentialIntegrityError} when the Campaign
   * still contains any Promo_Scenario (Req 6.8).
   */
  delete(id: string): Promise<void>;
}

/** Promo_Scenario repository (Req 7). */
export interface PromoScenarioRepository {
  findById(id: string): Promise<PromoScenario | null>;
  list(filter?: {
    brandId?: string;
    campaignId?: string;
    status?: PromoStatus;
  }): Promise<PromoScenario[]>;
  /**
   * Whether any Promo_Scenario references the product identified by
   * `(brandId, productId)`. Used to protect a Product from permanent deletion
   * while it is still referenced (Req 3.10 — archive instead). Identity is the
   * `(brandId, productId)` pair, never the product name (Req 3.4).
   */
  existsByProductRef(ref: ProductRef): Promise<boolean>;
  /** Insert; enforces FK Brand and FK Campaign existence. */
  insert(promo: PromoScenario): Promise<PromoScenario>;
  update(promo: PromoScenario): Promise<PromoScenario>;
  delete(id: string): Promise<void>;
}

/** Promo_Template repository (Req 5). */
export interface PromoTemplateRepository {
  findById(id: string): Promise<PromoTemplate | null>;
  list(filter?: { isBuiltIn?: boolean }): Promise<PromoTemplate[]>;
  insert(template: PromoTemplate): Promise<PromoTemplate>;
  update(template: PromoTemplate): Promise<PromoTemplate>;
  delete(id: string): Promise<void>;
}

/** Feedback_Record repository — two-way discussion thread (Req 14). */
export interface FeedbackRecordRepository {
  findById(id: string): Promise<FeedbackRecord | null>;
  /** All feedback for a promo, oldest-first (many records per promo). */
  listByPromo(promoRef: string): Promise<FeedbackRecord[]>;
  /** Insert; enforces FK Promo existence. */
  insert(feedback: FeedbackRecord): Promise<FeedbackRecord>;
  update(feedback: FeedbackRecord): Promise<FeedbackRecord>;
}

/** Approval_History repository — append-only audit log (Req 17). */
export interface ApprovalHistoryRepository {
  findById(id: string): Promise<ApprovalHistoryEntry | null>;
  /** All approval-history entries for a promo, oldest-first. */
  listByPromo(promoRef: string): Promise<ApprovalHistoryEntry[]>;
  /**
   * Append one entry. Written in the SAME transaction as the promo status
   * change so a failure rolls back the status (Req 17.3).
   */
  insert(entry: ApprovalHistoryEntry): Promise<ApprovalHistoryEntry>;
}

/**
 * Execution_Status repository (Req 18).
 *
 * Execution status is inlined on `PromoScenario.executionStatus` (design's
 * default decision). This port exposes focused read/write of that value;
 * atomic rollback on failure (Req 18.4) is provided by running the update
 * inside {@link TransactionRunner.runInTransaction}.
 */
export interface ExecutionStatusRepository {
  /** Current execution status of a promo (null until Approved). */
  get(promoRef: string): Promise<ExecutionStatus | null>;
  /** Persist a new execution status for the promo (FK Promo enforced). */
  set(promoRef: string, status: ExecutionStatus): Promise<void>;
}

/**
 * Attachment repository — supporting files on a promo (Req 21, nice-to-have).
 */
export interface AttachmentRepository {
  findById(id: string): Promise<Attachment | null>;
  /** All attachments for a promo, oldest-first. */
  listByPromo(promoRef: string): Promise<Attachment[]>;
  /** Insert; enforces FK Promo existence. */
  insert(attachment: Attachment): Promise<Attachment>;
  /** Delete an attachment by id. */
  delete(id: string): Promise<void>;
}
