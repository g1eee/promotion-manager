/**
 * In-memory implementations of the repository ports.
 *
 * Each repository operates on a shared {@link InMemoryStore} and enforces the
 * relational integrity rules described in the design's Database Schema (Final):
 * `UNIQUE(brandId)`, `UNIQUE(brandId, productId)`, Brand-ownership FKs, and
 * referential delete protection. Reads/writes clone entities so the store is
 * the single source of truth.
 */

import type {
  ApprovalHistoryEntry,
  Brand,
  BrandStatus,
  Campaign,
  CostConfiguration,
  ExecutionStatus,
  FeedbackRecord,
  Product,
  ProductRef,
  PromoScenario,
  PromoStatus,
  PromoTemplate,
  ProductStatus,
} from "../../domain";
import {
  ForeignKeyError,
  NotFoundError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "../errors";
import type {
  ApprovalHistoryRepository,
  BrandRepository,
  CampaignRepository,
  CostConfigurationRepository,
  ExecutionStatusRepository,
  FeedbackRecordRepository,
  ProductRepository,
  PromoScenarioRepository,
  PromoTemplateRepository,
} from "../repositories";
import { clone, InMemoryStore } from "./store";

export class InMemoryBrandRepository implements BrandRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<Brand | null> {
    const found = this.store.data.brands.get(id);
    return found ? clone(found) : null;
  }

  async findByBrandId(brandId: string): Promise<Brand | null> {
    for (const brand of this.store.data.brands.values()) {
      if (brand.brandId === brandId) return clone(brand);
    }
    return null;
  }

  async list(filter?: { status?: BrandStatus }): Promise<Brand[]> {
    const all = [...this.store.data.brands.values()];
    const filtered = filter?.status
      ? all.filter((b) => b.status === filter.status)
      : all;
    return filtered.map(clone);
  }

  async insert(brand: Brand): Promise<Brand> {
    for (const existing of this.store.data.brands.values()) {
      if (existing.brandId === brand.brandId) {
        throw new UniqueConstraintError("Brand", `brandId "${brand.brandId}" already exists`);
      }
    }
    this.store.data.brands.set(brand.id, clone(brand));
    return clone(brand);
  }

  async update(brand: Brand): Promise<Brand> {
    if (!this.store.data.brands.has(brand.id)) {
      throw new NotFoundError("Brand", brand.id);
    }
    for (const existing of this.store.data.brands.values()) {
      if (existing.id !== brand.id && existing.brandId === brand.brandId) {
        throw new UniqueConstraintError("Brand", `brandId "${brand.brandId}" already exists`);
      }
    }
    this.store.data.brands.set(brand.id, clone(brand));
    return clone(brand);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.data.brands.has(id)) {
      throw new NotFoundError("Brand", id);
    }
    const hasProduct = [...this.store.data.products.values()].some((p) => p.brandId === id);
    const hasCampaign = [...this.store.data.campaigns.values()].some((c) => c.brandId === id);
    const hasPromo = [...this.store.data.promos.values()].some((p) => p.brandId === id);
    if (hasProduct || hasCampaign || hasPromo) {
      throw new ReferentialIntegrityError(
        "Brand",
        "still has related Product, Campaign, or Promo_Scenario",
      );
    }
    this.store.data.brands.delete(id);
  }
}

export class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<Product | null> {
    const found = this.store.data.products.get(id);
    return found ? clone(found) : null;
  }

  async findByRef(ref: ProductRef): Promise<Product | null> {
    for (const product of this.store.data.products.values()) {
      if (product.brandId === ref.brandId && product.productId === ref.productId) {
        return clone(product);
      }
    }
    return null;
  }

  async findByProductId(productId: string): Promise<Product[]> {
    return [...this.store.data.products.values()]
      .filter((p) => p.productId === productId)
      .map(clone);
  }

  async list(filter?: { brandId?: string; status?: ProductStatus }): Promise<Product[]> {
    return [...this.store.data.products.values()]
      .filter((p) => (filter?.brandId ? p.brandId === filter.brandId : true))
      .filter((p) => (filter?.status ? p.status === filter.status : true))
      .map(clone);
  }

  async insert(product: Product): Promise<Product> {
    if (!this.store.data.brands.has(product.brandId)) {
      throw new ForeignKeyError("Product", `Brand "${product.brandId}"`);
    }
    for (const existing of this.store.data.products.values()) {
      if (existing.brandId === product.brandId && existing.productId === product.productId) {
        throw new UniqueConstraintError(
          "Product",
          `(brandId, productId) = ("${product.brandId}", "${product.productId}")`,
        );
      }
    }
    this.store.data.products.set(product.id, clone(product));
    return clone(product);
  }

  async update(product: Product): Promise<Product> {
    if (!this.store.data.products.has(product.id)) {
      throw new NotFoundError("Product", product.id);
    }
    for (const existing of this.store.data.products.values()) {
      if (
        existing.id !== product.id &&
        existing.brandId === product.brandId &&
        existing.productId === product.productId
      ) {
        throw new UniqueConstraintError(
          "Product",
          `(brandId, productId) = ("${product.brandId}", "${product.productId}")`,
        );
      }
    }
    this.store.data.products.set(product.id, clone(product));
    return clone(product);
  }

  async delete(id: string): Promise<void> {
    const product = this.store.data.products.get(id);
    if (!product) {
      throw new NotFoundError("Product", id);
    }
    const referenced = [...this.store.data.promos.values()].some((promo) =>
      promo.productRefs.some(
        (ref) => ref.brandId === product.brandId && ref.productId === product.productId,
      ),
    );
    if (referenced) {
      throw new ReferentialIntegrityError(
        "Product",
        "referenced by a Promo_Scenario (archive instead of delete)",
      );
    }
    this.store.data.products.delete(id);
  }
}

export class InMemoryCostConfigurationRepository implements CostConfigurationRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<CostConfiguration | null> {
    const found = this.store.data.costConfigs.get(id);
    return found ? clone(found) : null;
  }

  async findByBrandId(brandId: string): Promise<CostConfiguration | null> {
    for (const config of this.store.data.costConfigs.values()) {
      if (config.brandId === brandId) return clone(config);
    }
    return null;
  }

  async insert(config: CostConfiguration): Promise<CostConfiguration> {
    if (!this.store.data.brands.has(config.brandId)) {
      throw new ForeignKeyError("CostConfiguration", `Brand "${config.brandId}"`);
    }
    for (const existing of this.store.data.costConfigs.values()) {
      if (existing.brandId === config.brandId) {
        throw new UniqueConstraintError(
          "CostConfiguration",
          `brandId "${config.brandId}" already has a configuration`,
        );
      }
    }
    this.store.data.costConfigs.set(config.id, clone(config));
    return clone(config);
  }

  async update(config: CostConfiguration): Promise<CostConfiguration> {
    if (!this.store.data.costConfigs.has(config.id)) {
      throw new NotFoundError("CostConfiguration", config.id);
    }
    this.store.data.costConfigs.set(config.id, clone(config));
    return clone(config);
  }
}

export class InMemoryCampaignRepository implements CampaignRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<Campaign | null> {
    const found = this.store.data.campaigns.get(id);
    return found ? clone(found) : null;
  }

  async list(filter?: { brandId?: string }): Promise<Campaign[]> {
    return [...this.store.data.campaigns.values()]
      .filter((c) => (filter?.brandId ? c.brandId === filter.brandId : true))
      .map(clone);
  }

  async insert(campaign: Campaign): Promise<Campaign> {
    if (!this.store.data.brands.has(campaign.brandId)) {
      throw new ForeignKeyError("Campaign", `Brand "${campaign.brandId}"`);
    }
    this.store.data.campaigns.set(campaign.id, clone(campaign));
    return clone(campaign);
  }

  async update(campaign: Campaign): Promise<Campaign> {
    if (!this.store.data.campaigns.has(campaign.id)) {
      throw new NotFoundError("Campaign", campaign.id);
    }
    this.store.data.campaigns.set(campaign.id, clone(campaign));
    return clone(campaign);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.data.campaigns.has(id)) {
      throw new NotFoundError("Campaign", id);
    }
    const hasPromo = [...this.store.data.promos.values()].some((p) => p.campaignId === id);
    if (hasPromo) {
      throw new ReferentialIntegrityError("Campaign", "still contains a Promo_Scenario");
    }
    this.store.data.campaigns.delete(id);
  }
}

export class InMemoryPromoScenarioRepository implements PromoScenarioRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<PromoScenario | null> {
    const found = this.store.data.promos.get(id);
    return found ? clone(found) : null;
  }

  async list(filter?: {
    brandId?: string;
    campaignId?: string;
    status?: PromoStatus;
  }): Promise<PromoScenario[]> {
    return [...this.store.data.promos.values()]
      .filter((p) => (filter?.brandId ? p.brandId === filter.brandId : true))
      .filter((p) => (filter?.campaignId ? p.campaignId === filter.campaignId : true))
      .filter((p) => (filter?.status ? p.status === filter.status : true))
      .map(clone);
  }

  async existsByProductRef(ref: ProductRef): Promise<boolean> {
    return [...this.store.data.promos.values()].some((promo) =>
      promo.productRefs.some(
        (r) => r.brandId === ref.brandId && r.productId === ref.productId,
      ),
    );
  }

  async insert(promo: PromoScenario): Promise<PromoScenario> {
    if (!this.store.data.brands.has(promo.brandId)) {
      throw new ForeignKeyError("PromoScenario", `Brand "${promo.brandId}"`);
    }
    if (!this.store.data.campaigns.has(promo.campaignId)) {
      throw new ForeignKeyError("PromoScenario", `Campaign "${promo.campaignId}"`);
    }
    this.store.data.promos.set(promo.id, clone(promo));
    return clone(promo);
  }

  async update(promo: PromoScenario): Promise<PromoScenario> {
    if (!this.store.data.promos.has(promo.id)) {
      throw new NotFoundError("PromoScenario", promo.id);
    }
    if (!this.store.data.campaigns.has(promo.campaignId)) {
      throw new ForeignKeyError("PromoScenario", `Campaign "${promo.campaignId}"`);
    }
    this.store.data.promos.set(promo.id, clone(promo));
    return clone(promo);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.data.promos.has(id)) {
      throw new NotFoundError("PromoScenario", id);
    }
    // Cascade dependents (feedback, approval history) to preserve integrity.
    for (const [fid, f] of this.store.data.feedback) {
      if (f.promoRef === id) this.store.data.feedback.delete(fid);
    }
    for (const [aid, a] of this.store.data.approvalHistory) {
      if (a.promoRef === id) this.store.data.approvalHistory.delete(aid);
    }
    this.store.data.promos.delete(id);
  }
}

export class InMemoryPromoTemplateRepository implements PromoTemplateRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<PromoTemplate | null> {
    const found = this.store.data.promoTemplates.get(id);
    return found ? clone(found) : null;
  }

  async list(filter?: { isBuiltIn?: boolean }): Promise<PromoTemplate[]> {
    return [...this.store.data.promoTemplates.values()]
      .filter((t) => (filter?.isBuiltIn === undefined ? true : t.isBuiltIn === filter.isBuiltIn))
      .map(clone);
  }

  async insert(template: PromoTemplate): Promise<PromoTemplate> {
    this.store.data.promoTemplates.set(template.id, clone(template));
    return clone(template);
  }

  async update(template: PromoTemplate): Promise<PromoTemplate> {
    if (!this.store.data.promoTemplates.has(template.id)) {
      throw new NotFoundError("PromoTemplate", template.id);
    }
    this.store.data.promoTemplates.set(template.id, clone(template));
    return clone(template);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.data.promoTemplates.has(id)) {
      throw new NotFoundError("PromoTemplate", id);
    }
    this.store.data.promoTemplates.delete(id);
  }
}

export class InMemoryFeedbackRecordRepository implements FeedbackRecordRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<FeedbackRecord | null> {
    const found = this.store.data.feedback.get(id);
    return found ? clone(found) : null;
  }

  async listByPromo(promoRef: string): Promise<FeedbackRecord[]> {
    return [...this.store.data.feedback.values()]
      .filter((f) => f.promoRef === promoRef)
      .sort((a, b) => a.createdDate.getTime() - b.createdDate.getTime())
      .map(clone);
  }

  async insert(feedback: FeedbackRecord): Promise<FeedbackRecord> {
    if (!this.store.data.promos.has(feedback.promoRef)) {
      throw new ForeignKeyError("FeedbackRecord", `Promo "${feedback.promoRef}"`);
    }
    this.store.data.feedback.set(feedback.id, clone(feedback));
    return clone(feedback);
  }

  async update(feedback: FeedbackRecord): Promise<FeedbackRecord> {
    if (!this.store.data.feedback.has(feedback.id)) {
      throw new NotFoundError("FeedbackRecord", feedback.id);
    }
    this.store.data.feedback.set(feedback.id, clone(feedback));
    return clone(feedback);
  }
}

export class InMemoryApprovalHistoryRepository implements ApprovalHistoryRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<ApprovalHistoryEntry | null> {
    const found = this.store.data.approvalHistory.get(id);
    return found ? clone(found) : null;
  }

  async listByPromo(promoRef: string): Promise<ApprovalHistoryEntry[]> {
    return [...this.store.data.approvalHistory.values()]
      .filter((e) => e.promoRef === promoRef)
      .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
      .map(clone);
  }

  async insert(entry: ApprovalHistoryEntry): Promise<ApprovalHistoryEntry> {
    if (!this.store.data.promos.has(entry.promoRef)) {
      throw new ForeignKeyError("ApprovalHistoryEntry", `Promo "${entry.promoRef}"`);
    }
    this.store.data.approvalHistory.set(entry.id, clone(entry));
    return clone(entry);
  }
}

export class InMemoryExecutionStatusRepository implements ExecutionStatusRepository {
  constructor(private readonly store: InMemoryStore) {}

  async get(promoRef: string): Promise<ExecutionStatus | null> {
    const promo = this.store.data.promos.get(promoRef);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoRef);
    }
    return promo.executionStatus;
  }

  async set(promoRef: string, status: ExecutionStatus): Promise<void> {
    const promo = this.store.data.promos.get(promoRef);
    if (!promo) {
      throw new ForeignKeyError("ExecutionStatus", `Promo "${promoRef}"`);
    }
    const updated: PromoScenario = clone(promo);
    updated.executionStatus = status;
    this.store.data.promos.set(promoRef, updated);
  }
}
