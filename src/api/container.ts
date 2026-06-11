/**
 * Server-side dependency container for the API layer (MVP).
 *
 * Wires the in-memory persistence adapter to the application services and
 * exposes them to Next.js Route Handlers. A single {@link InMemoryPersistence}
 * instance is shared across all requests in the running server process and
 * stashed on `globalThis` so it survives module reloads (e.g. Next.js dev HMR),
 * keeping state consistent between requests within a session.
 *
 * MVP NOTE: this is an in-memory store, not a database. It is the same
 * temporary, process-local strategy used by the seed auth users (`auth/users`)
 * until the Prisma persistence adapter lands. Swapping in a DB-backed adapter
 * is a drop-in change because services depend only on repository ports.
 */

import { BrandStatus } from "@domain/enums";
import type { Brand } from "@domain/types";
import { loadConfig } from "@/config";
import { InMemoryPersistence } from "@persistence/in-memory";
import type { Persistence } from "@persistence/transaction";
import { getPrismaPersistence } from "@persistence/prisma/client";
import { BrandService } from "@services/brand-service";
import { ApprovalService } from "@services/approval-service";
import { CampaignService } from "@services/campaign-service";
import { CostConfigService } from "@services/cost-config-service";
import { DashboardService } from "@services/dashboard-service";
import { ProductService } from "@services/product-service";
import {
  AdminExecutionBoard,
  ExecutionStatusService,
} from "@services/promo-execution-service";
import { PromoCloneService } from "@services/promo-clone-service";
import { PromoHistoryService } from "@services/promo-history-service";
import { FeedbackService } from "@services/feedback-service";
import { ApprovalHistoryService } from "@services/approval-history-service";
import { PromoTemplateService } from "@services/promo-template-service";
import { CampaignHistoryService } from "@services/campaign-history-service";
import { AttachmentService } from "@services/attachment-service";
import { CombinedPromoExecutionService } from "@services/combined-execution-service";
import { PromoSimulatorService } from "@services/promo-simulator-service";
import { PromoService } from "@services/promo-service";

interface PmsGlobal {
  __pmsPersistence?: Persistence;
  __pmsSeedPromise?: Promise<void>;
}

const pmsGlobal = globalThis as unknown as PmsGlobal;

/** A seeded sample Brand mirroring the sample list used by the UI shell. */
function sampleBrand(
  id: string,
  brandId: string,
  brandName: string,
): Brand {
  const now = new Date();
  return {
    id,
    brandId,
    brandName,
    displayName: brandName,
    status: BrandStatus.Active,
    createdBy: "user-spv",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The four sample Brands (Kalova, Chanira, AMK, ATRIA) seeded once so the
 * management screen and other modules have data to work with on first run.
 */
const SAMPLE_BRANDS: readonly Brand[] = [
  sampleBrand("brand-kalova", "KALOVA", "Kalova"),
  sampleBrand("brand-chanira", "CHANIRA", "Chanira"),
  sampleBrand("brand-amk", "AMK", "AMK"),
  sampleBrand("brand-atria", "ATRIA", "ATRIA"),
];

/**
 * Lazily create and memoize the shared persistence instance.
 *
 * When `DATABASE_URL` is set, the Prisma (Postgres) adapter is used so data
 * persists across deploys/cold starts. Otherwise it falls back to the
 * in-memory adapter (local/tests), keeping the app runnable with zero config.
 */
function getPersistence(): Persistence {
  if (!pmsGlobal.__pmsPersistence) {
    const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
    pmsGlobal.__pmsPersistence = hasDatabase
      ? getPrismaPersistence()
      : new InMemoryPersistence();
  }
  return pmsGlobal.__pmsPersistence;
}

/** Seed the sample Brands exactly once for the process. */
async function ensureSeeded(persistence: Persistence): Promise<void> {
  if (!pmsGlobal.__pmsSeedPromise) {
    pmsGlobal.__pmsSeedPromise = (async () => {
      for (const brand of SAMPLE_BRANDS) {
        try {
          const existing = await persistence.brands.findByBrandId(brand.brandId);
          if (!existing) {
            await persistence.brands.insert(brand);
          }
        } catch {
          // Already present (idempotent seed); ignore duplicate inserts.
        }
      }
      // Seed the five built-in Promo Templates (Req 5.1), idempotently.
      await new PromoTemplateService({
        templates: persistence.promoTemplates,
      }).ensureSeeded();
    })();
  }
  await pmsGlobal.__pmsSeedPromise;
}

/** The services exposed to Route Handlers. */
export interface ApiContainer {
  readonly persistence: Persistence;
  readonly brandService: BrandService;
  readonly campaignService: CampaignService;
  readonly costConfigService: CostConfigService;
  readonly productService: ProductService;
  readonly promoService: PromoService;
  readonly promoCloneService: PromoCloneService;
  readonly promoHistoryService: PromoHistoryService;
  readonly feedbackService: FeedbackService;
  readonly approvalHistoryService: ApprovalHistoryService;
  readonly promoTemplateService: PromoTemplateService;
  readonly campaignHistoryService: CampaignHistoryService;
  readonly attachmentService: AttachmentService;
  readonly combinedExecutionService: CombinedPromoExecutionService;
  readonly promoSimulatorService: PromoSimulatorService;
  readonly approvalService: ApprovalService;
  readonly adminExecutionBoard: AdminExecutionBoard;
  readonly executionStatusService: ExecutionStatusService;
  readonly dashboardService: DashboardService;
}

/**
 * Resolve the API container, ensuring the store is seeded before first use.
 * Route Handlers `await getContainer()` then call the relevant service.
 */
export async function getContainer(): Promise<ApiContainer> {
  const persistence = getPersistence();
  await ensureSeeded(persistence);

  // Resolve feature flags from validated config (nice-to-have, Req 21/22).
  const config = loadConfig();
  const attachmentsEnabled = config.featureFlags.has("attachments");
  const combinedExecutionEnabled = config.featureFlags.has("combined-execution");

  const adminExecutionBoard = new AdminExecutionBoard({
    promos: persistence.promos,
    campaigns: persistence.campaigns,
    brands: persistence.brands,
    products: persistence.products,
    approvalHistory: persistence.approvalHistory,
  });

  return {
    persistence,
    brandService: new BrandService({ brands: persistence.brands }),
    campaignService: new CampaignService({
      campaigns: persistence.campaigns,
      brands: persistence.brands,
    }),
    costConfigService: new CostConfigService({
      costConfigs: persistence.costConfigs,
      brands: persistence.brands,
    }),
    productService: new ProductService({
      products: persistence.products,
      brands: persistence.brands,
      promos: persistence.promos,
    }),
    promoService: new PromoService({
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
      products: persistence.products,
    }),
    promoCloneService: new PromoCloneService({
      promos: persistence.promos,
    }),
    promoHistoryService: new PromoHistoryService({
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
    }),
    feedbackService: new FeedbackService({
      feedback: persistence.feedback,
      promos: persistence.promos,
    }),
    approvalHistoryService: new ApprovalHistoryService({
      approvalHistory: persistence.approvalHistory,
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
    }),
    promoTemplateService: new PromoTemplateService({
      templates: persistence.promoTemplates,
    }),
    campaignHistoryService: new CampaignHistoryService({
      campaigns: persistence.campaigns,
      promos: persistence.promos,
      brands: persistence.brands,
    }),
    attachmentService: new AttachmentService({
      attachments: persistence.attachments,
      promos: persistence.promos,
      enabled: attachmentsEnabled,
    }),
    combinedExecutionService: new CombinedPromoExecutionService({
      board: adminExecutionBoard,
      enabled: combinedExecutionEnabled,
    }),
    promoSimulatorService: new PromoSimulatorService({
      promos: persistence.promos,
      products: persistence.products,
      costConfigs: new CostConfigService({
        costConfigs: persistence.costConfigs,
        brands: persistence.brands,
      }),
    }),
    approvalService: new ApprovalService({
      transactionRunner: persistence,
    }),
    adminExecutionBoard,
    executionStatusService: new ExecutionStatusService({
      transactionRunner: persistence,
    }),
    dashboardService: new DashboardService({
      brands: persistence.brands,
      campaigns: persistence.campaigns,
      promos: persistence.promos,
      feedback: persistence.feedback,
      approvalHistory: persistence.approvalHistory,
    }),
  };
}
