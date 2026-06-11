/**
 * DashboardService - actionable operational summary (Req 2).
 *
 * Dashboard values are recomputed from the latest Campaign, Promo_Scenario,
 * Feedback_Record, and Approval_History data whenever the summary is loaded.
 * That load-time recompute settles the "pending update" obligation in Req 2.4
 * without introducing a stale cache in the MVP in-memory adapter.
 */

import { ExecutionStatus, PromoStatus } from "../domain";
import type {
  ApprovalHistoryEntry,
  Brand,
  Campaign,
  FeedbackRecord,
  PromoScenario,
} from "../domain";
import type {
  ApprovalHistoryRepository,
  BrandRepository,
  CampaignRepository,
  FeedbackRecordRepository,
  PromoScenarioRepository,
} from "../persistence";

export interface DashboardServiceDeps {
  readonly brands: BrandRepository;
  readonly campaigns: CampaignRepository;
  readonly promos: PromoScenarioRepository;
  readonly feedback: FeedbackRecordRepository;
  readonly approvalHistory: ApprovalHistoryRepository;
}

export interface DashboardSummaryQuery {
  readonly brandId?: string;
  readonly userId: string;
  readonly limit?: number;
}

export interface DashboardWidgets {
  readonly totalCampaigns: number;
  readonly totalPromos: number;
  readonly draftPromos: number;
  readonly reviewPromos: number;
  readonly approvedPromos: number;
  readonly rejectedPromos: number;
  readonly activePromos: number;
  readonly completedPromos: number;
  readonly pendingReviewPromos: number;
  readonly waitingForExecutionPromos: number;
}

export interface DashboardWorkQueue {
  readonly pendingReviews: number;
  readonly rejectedPromos: number;
  readonly unreadFeedback: number;
  readonly waitingForExecution: number;
}

export interface RecentCampaignActivity {
  readonly id: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly name: string;
  readonly status: string;
  readonly promoCount: number;
  readonly occurredAt: Date;
}

export interface RecentPromoActivity {
  readonly id: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly name: string;
  readonly promoType: string;
  readonly status: string;
  readonly productCount: number;
  readonly occurredAt: Date;
}

export interface RecentApprovalActivity {
  readonly id: string;
  readonly promoId: string;
  readonly promoName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly status: string;
  readonly changedBy: string | null;
  readonly occurredAt: Date;
}

export interface DashboardRecentActivity {
  readonly campaigns: RecentCampaignActivity[];
  readonly promos: RecentPromoActivity[];
  readonly approvals: RecentApprovalActivity[];
}

export interface DashboardSummary {
  readonly brandId: string | null;
  readonly brandName: string | null;
  readonly widgets: DashboardWidgets;
  readonly workQueue: DashboardWorkQueue;
  readonly recentActivity: DashboardRecentActivity;
  readonly recomputedAt: Date;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function matchesBrandKey(brand: Brand, key: string): boolean {
  const normalized = normalizeKey(key);
  const candidates = [
    brand.id,
    brand.brandId,
    brand.brandName,
    brand.displayName,
  ].map(normalizeKey);
  return candidates.includes(normalized) || normalizeKey(brand.id).endsWith(`-${normalized}`);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(10, Math.floor(limit)));
}

function countByStatus(promos: readonly PromoScenario[], status: PromoStatus): number {
  return promos.filter((promo) => promo.status === status).length;
}

function isWaitingForExecution(promo: PromoScenario): boolean {
  return (
    promo.status === PromoStatus.Approved &&
    promo.executionStatus !== ExecutionStatus.Completed
  );
}

function hasUserRead(feedback: FeedbackRecord, userId: string): boolean {
  return feedback.readBy?.includes(userId) ?? false;
}

function newestFirst<T>(
  items: readonly T[],
  getDate: (item: T) => Date,
): T[] {
  return [...items].sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}

export class DashboardService {
  constructor(private readonly deps: DashboardServiceDeps) {}

  async summary(query: DashboardSummaryQuery): Promise<DashboardSummary> {
    const brands = await this.deps.brands.list();
    const resolvedBrand = this.resolveBrandFilter(brands, query.brandId);
    const hasUnmatchedBrandFilter =
      query.brandId !== undefined &&
      query.brandId.trim() !== "" &&
      resolvedBrand === null;

    if (hasUnmatchedBrandFilter) {
      return this.emptySummary();
    }

    const brandFilter = resolvedBrand ? { brandId: resolvedBrand.id } : undefined;
    const [campaigns, promos] = await Promise.all([
      this.deps.campaigns.list(brandFilter),
      this.deps.promos.list(brandFilter),
    ]);

    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const promoCountByCampaign = this.countPromosByCampaign(promos);
    const feedbackByPromo = await this.feedbackByPromo(promos);
    const approvalsByPromo = await this.approvalsByPromo(promos);

    return {
      brandId: resolvedBrand?.id ?? null,
      brandName: resolvedBrand?.displayName ?? null,
      widgets: this.widgets(campaigns, promos),
      workQueue: this.workQueue(promos, feedbackByPromo, query.userId),
      recentActivity: this.recentActivity({
        campaigns,
        promos,
        approvalsByPromo,
        brandById,
        campaignById,
        promoCountByCampaign,
        limit: normalizeLimit(query.limit),
      }),
      recomputedAt: new Date(),
    };
  }

  private resolveBrandFilter(
    brands: readonly Brand[],
    brandKey: string | undefined,
  ): Brand | null {
    if (!brandKey || brandKey.trim() === "") {
      return null;
    }
    return brands.find((brand) => matchesBrandKey(brand, brandKey)) ?? null;
  }

  private emptySummary(): DashboardSummary {
    return {
      brandId: null,
      brandName: null,
      widgets: this.widgets([], []),
      workQueue: {
        pendingReviews: 0,
        rejectedPromos: 0,
        unreadFeedback: 0,
        waitingForExecution: 0,
      },
      recentActivity: {
        campaigns: [],
        promos: [],
        approvals: [],
      },
      recomputedAt: new Date(),
    };
  }

  private widgets(
    campaigns: readonly Campaign[],
    promos: readonly PromoScenario[],
  ): DashboardWidgets {
    const reviewPromos = countByStatus(promos, PromoStatus.Review);
    const waitingForExecutionPromos = promos.filter(isWaitingForExecution).length;

    return {
      totalCampaigns: campaigns.length,
      totalPromos: promos.length,
      draftPromos: countByStatus(promos, PromoStatus.Draft),
      reviewPromos,
      approvedPromos: countByStatus(promos, PromoStatus.Approved),
      rejectedPromos: countByStatus(promos, PromoStatus.Rejected),
      activePromos: countByStatus(promos, PromoStatus.Active),
      completedPromos: countByStatus(promos, PromoStatus.Completed),
      pendingReviewPromos: reviewPromos,
      waitingForExecutionPromos,
    };
  }

  private workQueue(
    promos: readonly PromoScenario[],
    feedbackByPromo: ReadonlyMap<string, readonly FeedbackRecord[]>,
    userId: string,
  ): DashboardWorkQueue {
    let unreadFeedback = 0;
    for (const promo of promos) {
      const records = feedbackByPromo.get(promo.id) ?? [];
      unreadFeedback += records.filter((record) => !hasUserRead(record, userId)).length;
    }

    return {
      pendingReviews: countByStatus(promos, PromoStatus.Review),
      rejectedPromos: countByStatus(promos, PromoStatus.Rejected),
      unreadFeedback,
      waitingForExecution: promos.filter(isWaitingForExecution).length,
    };
  }

  private async feedbackByPromo(
    promos: readonly PromoScenario[],
  ): Promise<Map<string, FeedbackRecord[]>> {
    const entries = await Promise.all(
      promos.map(async (promo) => [
        promo.id,
        await this.deps.feedback.listByPromo(promo.id),
      ] as const),
    );
    return new Map(entries);
  }

  private async approvalsByPromo(
    promos: readonly PromoScenario[],
  ): Promise<Map<string, ApprovalHistoryEntry[]>> {
    const entries = await Promise.all(
      promos.map(async (promo) => [
        promo.id,
        await this.deps.approvalHistory.listByPromo(promo.id),
      ] as const),
    );
    return new Map(entries);
  }

  private countPromosByCampaign(
    promos: readonly PromoScenario[],
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const promo of promos) {
      counts.set(promo.campaignId, (counts.get(promo.campaignId) ?? 0) + 1);
    }
    return counts;
  }

  private recentActivity(input: {
    readonly campaigns: readonly Campaign[];
    readonly promos: readonly PromoScenario[];
    readonly approvalsByPromo: ReadonlyMap<string, readonly ApprovalHistoryEntry[]>;
    readonly brandById: ReadonlyMap<string, Brand>;
    readonly campaignById: ReadonlyMap<string, Campaign>;
    readonly promoCountByCampaign: ReadonlyMap<string, number>;
    readonly limit: number;
  }): DashboardRecentActivity {
    const campaigns = newestFirst(input.campaigns, (campaign) => campaign.updatedAt)
      .slice(0, input.limit)
      .map((campaign) => this.toRecentCampaign(campaign, input.brandById, input.promoCountByCampaign));

    const promos = newestFirst(input.promos, (promo) => promo.updatedAt)
      .slice(0, input.limit)
      .map((promo) => this.toRecentPromo(promo, input.brandById, input.campaignById));

    const approvalItems = input.promos.flatMap((promo) =>
      (input.approvalsByPromo.get(promo.id) ?? []).map((approval) => ({
        approval,
        promo,
      })),
    );
    const approvals = newestFirst(approvalItems, (item) => item.approval.changedAt)
      .slice(0, input.limit)
      .map((item) =>
        this.toRecentApproval(
          item.approval,
          item.promo,
          input.brandById,
          input.campaignById,
        ),
      );

    return { campaigns, promos, approvals };
  }

  private toRecentCampaign(
    campaign: Campaign,
    brandById: ReadonlyMap<string, Brand>,
    promoCountByCampaign: ReadonlyMap<string, number>,
  ): RecentCampaignActivity {
    const brand = brandById.get(campaign.brandId);
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      brandName: brand?.displayName ?? campaign.brandId,
      name: campaign.nama,
      status: campaign.status,
      promoCount: promoCountByCampaign.get(campaign.id) ?? 0,
      occurredAt: campaign.updatedAt,
    };
  }

  private toRecentPromo(
    promo: PromoScenario,
    brandById: ReadonlyMap<string, Brand>,
    campaignById: ReadonlyMap<string, Campaign>,
  ): RecentPromoActivity {
    const brand = brandById.get(promo.brandId);
    const campaign = campaignById.get(promo.campaignId);
    return {
      id: promo.id,
      brandId: promo.brandId,
      brandName: brand?.displayName ?? promo.brandId,
      campaignId: promo.campaignId,
      campaignName: campaign?.nama ?? promo.campaignId,
      name: promo.namaPromo,
      promoType: promo.promoType,
      status: promo.status,
      productCount: promo.productRefs.length,
      occurredAt: promo.updatedAt,
    };
  }

  private toRecentApproval(
    approval: ApprovalHistoryEntry,
    promo: PromoScenario,
    brandById: ReadonlyMap<string, Brand>,
    campaignById: ReadonlyMap<string, Campaign>,
  ): RecentApprovalActivity {
    const brand = brandById.get(promo.brandId);
    const campaign = campaignById.get(promo.campaignId);
    return {
      id: approval.id,
      promoId: promo.id,
      promoName: promo.namaPromo,
      campaignId: promo.campaignId,
      campaignName: campaign?.nama ?? promo.campaignId,
      brandId: promo.brandId,
      brandName: brand?.displayName ?? promo.brandId,
      status: approval.status,
      changedBy: approval.changedBy ?? null,
      occurredAt: approval.changedAt,
    };
  }
}
