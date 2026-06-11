/**
 * Prisma-backed persistence adapter.
 *
 * Implements the same repository ports as the in-memory adapter, so services
 * are unchanged (Dependency Inversion). Prisma error codes are translated to
 * the domain persistence errors the API layer already maps to HTTP:
 *   - P2002 unique constraint   -> UniqueConstraintError
 *   - P2003 foreign key         -> ForeignKeyError
 *   - P2025 record not found     -> NotFoundError
 * Referential-delete protection (Req 19.6, 3.10, 6.8) is enforced explicitly
 * before delete so a clear ReferentialIntegrityError is raised.
 *
 * `runInTransaction` uses Prisma interactive transactions: a thrown error rolls
 * the whole unit back (Req 17.3, 18.4).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import type {
  ApprovalHistoryEntry,
  Attachment,
  Brand,
  BrandStatus,
  Campaign,
  CostConfiguration,
  ExecutionStatus,
  FeedbackRecord,
  Product,
  ProductRef,
  ProductStatus,
  PromoScenario,
  PromoStatus,
  PromoTemplate,
} from "../../domain";
import {
  ForeignKeyError,
  NotFoundError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "../errors";
import type {
  ApprovalHistoryRepository,
  AttachmentRepository,
  BrandRepository,
  CampaignRepository,
  CostConfigurationRepository,
  ExecutionStatusRepository,
  FeedbackRecordRepository,
  ProductRepository,
  PromoScenarioRepository,
  PromoTemplateRepository,
} from "../repositories";
import type { Persistence, UnitOfWork } from "../transaction";
import * as map from "./mappers";

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Translate known Prisma errors to domain persistence errors. */
function translate(error: unknown, entity: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new UniqueConstraintError(entity, "unique constraint");
    }
    if (error.code === "P2003") {
      throw new ForeignKeyError(entity, "referenced parent");
    }
    if (error.code === "P2025") {
      throw new NotFoundError(entity, "unknown");
    }
  }
  throw error;
}

class PrismaBrandRepository implements BrandRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<Brand | null> {
    const row = await this.db.brand.findUnique({ where: { id } });
    return row ? map.toBrand(row) : null;
  }
  async findByBrandId(brandId: string): Promise<Brand | null> {
    const row = await this.db.brand.findUnique({ where: { brandId } });
    return row ? map.toBrand(row) : null;
  }
  async list(filter?: { status?: BrandStatus }): Promise<Brand[]> {
    const rows = await this.db.brand.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
    });
    return rows.map(map.toBrand);
  }
  async insert(brand: Brand): Promise<Brand> {
    try {
      const row = await this.db.brand.create({ data: brand });
      return map.toBrand(row);
    } catch (error) {
      translate(error, "Brand");
    }
  }
  async update(brand: Brand): Promise<Brand> {
    try {
      const row = await this.db.brand.update({
        where: { id: brand.id },
        data: brand,
      });
      return map.toBrand(row);
    } catch (error) {
      translate(error, "Brand");
    }
  }
  async delete(id: string): Promise<void> {
    const [products, campaigns, promos] = await Promise.all([
      this.db.product.count({ where: { brandId: id } }),
      this.db.campaign.count({ where: { brandId: id } }),
      this.db.promoScenario.count({ where: { brandId: id } }),
    ]);
    if (products + campaigns + promos > 0) {
      throw new ReferentialIntegrityError(
        "Brand",
        "still has related Product, Campaign, or Promo_Scenario",
      );
    }
    try {
      await this.db.brand.delete({ where: { id } });
    } catch (error) {
      translate(error, "Brand");
    }
  }
}

class PrismaProductRepository implements ProductRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<Product | null> {
    const row = await this.db.product.findUnique({ where: { id } });
    return row ? map.toProduct(row) : null;
  }
  async findByRef(ref: ProductRef): Promise<Product | null> {
    const row = await this.db.product.findUnique({
      where: { brandId_productId: { brandId: ref.brandId, productId: ref.productId } },
    });
    return row ? map.toProduct(row) : null;
  }
  async findByProductId(productId: string): Promise<Product[]> {
    const rows = await this.db.product.findMany({ where: { productId } });
    return rows.map(map.toProduct);
  }
  async list(filter?: { brandId?: string; status?: ProductStatus }): Promise<Product[]> {
    const rows = await this.db.product.findMany({
      where: {
        brandId: filter?.brandId,
        status: filter?.status,
      },
    });
    return rows.map(map.toProduct);
  }
  async insert(product: Product): Promise<Product> {
    try {
      const row = await this.db.product.create({ data: product });
      return map.toProduct(row);
    } catch (error) {
      translate(error, "Product");
    }
  }
  async update(product: Product): Promise<Product> {
    try {
      const row = await this.db.product.update({
        where: { id: product.id },
        data: product,
      });
      return map.toProduct(row);
    } catch (error) {
      translate(error, "Product");
    }
  }
  async delete(id: string): Promise<void> {
    const product = await this.db.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError("Product", id);
    }
    const referencingPromos = await this.db.promoScenario.findMany({
      select: { productRefs: true },
    });
    const referenced = referencingPromos.some((p) =>
      ((p.productRefs as unknown as ProductRef[]) ?? []).some(
        (ref) => ref.brandId === product.brandId && ref.productId === product.productId,
      ),
    );
    if (referenced) {
      throw new ReferentialIntegrityError(
        "Product",
        "referenced by a Promo_Scenario (archive instead of delete)",
      );
    }
    await this.db.product.delete({ where: { id } });
  }
}

class PrismaCostConfigurationRepository implements CostConfigurationRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<CostConfiguration | null> {
    const row = await this.db.costConfiguration.findUnique({ where: { id } });
    return row ? map.toCostConfiguration(row) : null;
  }
  async findByBrandId(brandId: string): Promise<CostConfiguration | null> {
    const row = await this.db.costConfiguration.findUnique({ where: { brandId } });
    return row ? map.toCostConfiguration(row) : null;
  }
  async insert(config: CostConfiguration): Promise<CostConfiguration> {
    try {
      const row = await this.db.costConfiguration.create({
        data: map.costConfigToRow(config),
      });
      return map.toCostConfiguration(row);
    } catch (error) {
      translate(error, "CostConfiguration");
    }
  }
  async update(config: CostConfiguration): Promise<CostConfiguration> {
    try {
      const row = await this.db.costConfiguration.update({
        where: { id: config.id },
        data: map.costConfigToRow(config),
      });
      return map.toCostConfiguration(row);
    } catch (error) {
      translate(error, "CostConfiguration");
    }
  }
}

class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<Campaign | null> {
    const row = await this.db.campaign.findUnique({ where: { id } });
    return row ? map.toCampaign(row) : null;
  }
  async list(filter?: { brandId?: string }): Promise<Campaign[]> {
    const rows = await this.db.campaign.findMany({
      where: { brandId: filter?.brandId },
    });
    return rows.map(map.toCampaign);
  }
  async insert(campaign: Campaign): Promise<Campaign> {
    try {
      const row = await this.db.campaign.create({ data: campaign });
      return map.toCampaign(row);
    } catch (error) {
      translate(error, "Campaign");
    }
  }
  async update(campaign: Campaign): Promise<Campaign> {
    try {
      const row = await this.db.campaign.update({
        where: { id: campaign.id },
        data: campaign,
      });
      return map.toCampaign(row);
    } catch (error) {
      translate(error, "Campaign");
    }
  }
  async delete(id: string): Promise<void> {
    const promos = await this.db.promoScenario.count({ where: { campaignId: id } });
    if (promos > 0) {
      throw new ReferentialIntegrityError("Campaign", "still contains a Promo_Scenario");
    }
    try {
      await this.db.campaign.delete({ where: { id } });
    } catch (error) {
      translate(error, "Campaign");
    }
  }
}

class PrismaPromoScenarioRepository implements PromoScenarioRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<PromoScenario | null> {
    const row = await this.db.promoScenario.findUnique({ where: { id } });
    return row ? map.toPromoScenario(row) : null;
  }
  async list(filter?: {
    brandId?: string;
    campaignId?: string;
    status?: PromoStatus;
  }): Promise<PromoScenario[]> {
    const rows = await this.db.promoScenario.findMany({
      where: {
        brandId: filter?.brandId,
        campaignId: filter?.campaignId,
        status: filter?.status,
      },
    });
    return rows.map(map.toPromoScenario);
  }
  async existsByProductRef(ref: ProductRef): Promise<boolean> {
    const promos = await this.db.promoScenario.findMany({ select: { productRefs: true } });
    return promos.some((p) =>
      ((p.productRefs as unknown as ProductRef[]) ?? []).some(
        (r) => r.brandId === ref.brandId && r.productId === ref.productId,
      ),
    );
  }
  async insert(promo: PromoScenario): Promise<PromoScenario> {
    try {
      const row = await this.db.promoScenario.create({
        data: {
          ...promo,
          rules: promo.rules as unknown as Prisma.InputJsonValue,
          productRefs: promo.productRefs as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toPromoScenario(row);
    } catch (error) {
      translate(error, "PromoScenario");
    }
  }
  async update(promo: PromoScenario): Promise<PromoScenario> {
    try {
      const row = await this.db.promoScenario.update({
        where: { id: promo.id },
        data: {
          ...promo,
          rules: promo.rules as unknown as Prisma.InputJsonValue,
          productRefs: promo.productRefs as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toPromoScenario(row);
    } catch (error) {
      translate(error, "PromoScenario");
    }
  }
  async delete(id: string): Promise<void> {
    try {
      // Cascade dependents first so the promo row can be removed. Runs against
      // whichever client is bound (standalone or an interactive transaction).
      await this.db.feedbackRecord.deleteMany({ where: { promoRef: id } });
      await this.db.approvalHistory.deleteMany({ where: { promoRef: id } });
      await this.db.attachment.deleteMany({ where: { promoRef: id } });
      await this.db.promoScenario.delete({ where: { id } });
    } catch (error) {
      translate(error, "PromoScenario");
    }
  }
}

class PrismaPromoTemplateRepository implements PromoTemplateRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<PromoTemplate | null> {
    const row = await this.db.promoTemplate.findUnique({ where: { id } });
    return row ? map.toPromoTemplate(row) : null;
  }
  async list(filter?: { isBuiltIn?: boolean }): Promise<PromoTemplate[]> {
    const rows = await this.db.promoTemplate.findMany({
      where: filter?.isBuiltIn === undefined ? undefined : { isBuiltIn: filter.isBuiltIn },
    });
    return rows.map(map.toPromoTemplate);
  }
  async insert(template: PromoTemplate): Promise<PromoTemplate> {
    try {
      const row = await this.db.promoTemplate.create({
        data: {
          ...template,
          config: template.config as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toPromoTemplate(row);
    } catch (error) {
      translate(error, "PromoTemplate");
    }
  }
  async update(template: PromoTemplate): Promise<PromoTemplate> {
    try {
      const row = await this.db.promoTemplate.update({
        where: { id: template.id },
        data: {
          ...template,
          config: template.config as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toPromoTemplate(row);
    } catch (error) {
      translate(error, "PromoTemplate");
    }
  }
  async delete(id: string): Promise<void> {
    try {
      await this.db.promoTemplate.delete({ where: { id } });
    } catch (error) {
      translate(error, "PromoTemplate");
    }
  }
}

class PrismaFeedbackRecordRepository implements FeedbackRecordRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<FeedbackRecord | null> {
    const row = await this.db.feedbackRecord.findUnique({ where: { id } });
    return row ? map.toFeedbackRecord(row) : null;
  }
  async listByPromo(promoRef: string): Promise<FeedbackRecord[]> {
    const rows = await this.db.feedbackRecord.findMany({
      where: { promoRef },
      orderBy: { createdDate: "asc" },
    });
    return rows.map(map.toFeedbackRecord);
  }
  async insert(feedback: FeedbackRecord): Promise<FeedbackRecord> {
    try {
      const row = await this.db.feedbackRecord.create({
        data: {
          ...feedback,
          readBy: (feedback.readBy ?? []) as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toFeedbackRecord(row);
    } catch (error) {
      translate(error, "FeedbackRecord");
    }
  }
  async update(feedback: FeedbackRecord): Promise<FeedbackRecord> {
    try {
      const row = await this.db.feedbackRecord.update({
        where: { id: feedback.id },
        data: {
          ...feedback,
          readBy: (feedback.readBy ?? []) as unknown as Prisma.InputJsonValue,
        },
      });
      return map.toFeedbackRecord(row);
    } catch (error) {
      translate(error, "FeedbackRecord");
    }
  }
}

class PrismaApprovalHistoryRepository implements ApprovalHistoryRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<ApprovalHistoryEntry | null> {
    const row = await this.db.approvalHistory.findUnique({ where: { id } });
    return row ? map.toApprovalHistoryEntry(row) : null;
  }
  async listByPromo(promoRef: string): Promise<ApprovalHistoryEntry[]> {
    const rows = await this.db.approvalHistory.findMany({
      where: { promoRef },
      orderBy: { changedAt: "asc" },
    });
    return rows.map(map.toApprovalHistoryEntry);
  }
  async insert(entry: ApprovalHistoryEntry): Promise<ApprovalHistoryEntry> {
    try {
      const row = await this.db.approvalHistory.create({
        data: {
          id: entry.id,
          promoRef: entry.promoRef,
          status: entry.status,
          changedBy: entry.changedBy ?? null,
          changedAt: entry.changedAt,
        },
      });
      return map.toApprovalHistoryEntry(row);
    } catch (error) {
      translate(error, "ApprovalHistoryEntry");
    }
  }
}

class PrismaExecutionStatusRepository implements ExecutionStatusRepository {
  constructor(private readonly db: Db) {}
  async get(promoRef: string): Promise<ExecutionStatus | null> {
    const promo = await this.db.promoScenario.findUnique({
      where: { id: promoRef },
      select: { executionStatus: true },
    });
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoRef);
    }
    return (promo.executionStatus as ExecutionStatus | null) ?? null;
  }
  async set(promoRef: string, status: ExecutionStatus): Promise<void> {
    try {
      await this.db.promoScenario.update({
        where: { id: promoRef },
        data: { executionStatus: status },
      });
    } catch (error) {
      translate(error, "ExecutionStatus");
    }
  }
}

class PrismaAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Db) {}
  async findById(id: string): Promise<Attachment | null> {
    const row = await this.db.attachment.findUnique({ where: { id } });
    return row ? map.toAttachment(row) : null;
  }
  async listByPromo(promoRef: string): Promise<Attachment[]> {
    const rows = await this.db.attachment.findMany({
      where: { promoRef },
      orderBy: { uploadDate: "asc" },
    });
    return rows.map(map.toAttachment);
  }
  async insert(attachment: Attachment): Promise<Attachment> {
    try {
      const row = await this.db.attachment.create({ data: attachment });
      return map.toAttachment(row);
    } catch (error) {
      translate(error, "Attachment");
    }
  }
  async delete(id: string): Promise<void> {
    try {
      await this.db.attachment.delete({ where: { id } });
    } catch (error) {
      translate(error, "Attachment");
    }
  }
}

/** Build the repository set bound to a given Prisma client/transaction. */
function buildRepositories(db: Db): UnitOfWork {
  return {
    brands: new PrismaBrandRepository(db),
    products: new PrismaProductRepository(db),
    campaigns: new PrismaCampaignRepository(db),
    promos: new PrismaPromoScenarioRepository(db),
    costConfigs: new PrismaCostConfigurationRepository(db),
    promoTemplates: new PrismaPromoTemplateRepository(db),
    feedback: new PrismaFeedbackRecordRepository(db),
    approvalHistory: new PrismaApprovalHistoryRepository(db),
    executionStatus: new PrismaExecutionStatusRepository(db),
    attachments: new PrismaAttachmentRepository(db),
  };
}

export class PrismaPersistence implements Persistence {
  readonly brands: BrandRepository;
  readonly products: ProductRepository;
  readonly campaigns: CampaignRepository;
  readonly promos: PromoScenarioRepository;
  readonly costConfigs: CostConfigurationRepository;
  readonly promoTemplates: PromoTemplateRepository;
  readonly feedback: FeedbackRecordRepository;
  readonly approvalHistory: ApprovalHistoryRepository;
  readonly executionStatus: ExecutionStatusRepository;
  readonly attachments: AttachmentRepository;

  constructor(private readonly client: PrismaClient) {
    const repos = buildRepositories(client);
    this.brands = repos.brands;
    this.products = repos.products;
    this.campaigns = repos.campaigns;
    this.promos = repos.promos;
    this.costConfigs = repos.costConfigs;
    this.promoTemplates = repos.promoTemplates;
    this.feedback = repos.feedback;
    this.approvalHistory = repos.approvalHistory;
    this.executionStatus = repos.executionStatus;
    this.attachments = repos.attachments;
  }

  async runInTransaction<T>(work: (uow: UnitOfWork) => Promise<T> | T): Promise<T> {
    return this.client.$transaction(async (tx) => {
      const uow = buildRepositories(tx);
      return work(uow);
    });
  }
}
