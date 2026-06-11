/**
 * ApprovalHistoryService — governance/audit listing of promo approval changes
 * (Req 17.1).
 *
 * Approval_History entries are written by {@link ApprovalService.changeStatus}
 * (Task 14.1) inside the same transaction as each status change. This service
 * is read-only: it aggregates those entries across promos and projects each as
 * a row showing Nama Promo, Campaign, Tanggal Approval, and Status Approval
 * (Req 17.1). It honours the Global Brand Selector context by scoping to the
 * promos of a Brand when one is supplied.
 *
 * The repository port exposes `listByPromo`, so the service walks the relevant
 * promos and flattens their histories — keeping the persistence contract
 * minimal while the in-memory adapter (and a future DB adapter) stay drop-in.
 */

import type {
  ApprovalHistoryEntry,
  Brand,
  Campaign,
  PromoScenario,
  PromoStatus,
} from "../domain";
import type {
  ApprovalHistoryRepository,
  BrandRepository,
  CampaignRepository,
  PromoScenarioRepository,
} from "../persistence";

export interface ApprovalHistoryServiceDeps {
  readonly approvalHistory: ApprovalHistoryRepository;
  readonly promos: PromoScenarioRepository;
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
}

/** A single Approval History row (Req 17.1). */
export interface ApprovalHistoryItem {
  readonly id: string;
  readonly promoId: string;
  readonly promoName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly brandId: string;
  readonly brandName: string;
  /** Status Approval recorded by the change. */
  readonly status: PromoStatus;
  /** Tanggal Approval — when the status change was recorded. */
  readonly changedAt: Date;
  readonly changedBy: string | null;
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
  return (
    candidates.includes(normalized) ||
    normalizeKey(brand.id).endsWith(`-${normalized}`)
  );
}

export class ApprovalHistoryService {
  constructor(private readonly deps: ApprovalHistoryServiceDeps) {}

  /**
   * List every Approval_History entry as a governance/audit row, newest-first
   * (Req 17.1). When a Brand context is supplied, only the approval history of
   * that Brand's promos is returned.
   */
  async list(filter: { brand?: string } = {}): Promise<ApprovalHistoryItem[]> {
    const brands = await this.deps.brands.list();
    const resolvedBrandId = this.resolveBrandFilter(brands, filter.brand);
    // A Brand filter that matches no Brand yields no rows.
    if (filter.brand && filter.brand.trim() !== "" && !resolvedBrandId) {
      return [];
    }

    const promos = await this.deps.promos.list(
      resolvedBrandId ? { brandId: resolvedBrandId } : undefined,
    );
    const campaigns = await this.deps.campaigns.list(
      resolvedBrandId ? { brandId: resolvedBrandId } : undefined,
    );

    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign]),
    );

    const histories = await Promise.all(
      promos.map(async (promo) => ({
        promo,
        entries: await this.deps.approvalHistory.listByPromo(promo.id),
      })),
    );

    const rows = histories.flatMap(({ promo, entries }) =>
      entries.map((entry) =>
        this.toItem(entry, promo, brandById, campaignById),
      ),
    );

    return rows.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }

  private resolveBrandFilter(
    brands: readonly Brand[],
    brandKey: string | undefined,
  ): string | null {
    if (!brandKey || brandKey.trim() === "") {
      return null;
    }
    return brands.find((brand) => matchesBrandKey(brand, brandKey))?.id ?? null;
  }

  private toItem(
    entry: ApprovalHistoryEntry,
    promo: PromoScenario,
    brandById: ReadonlyMap<string, Brand>,
    campaignById: ReadonlyMap<string, Campaign>,
  ): ApprovalHistoryItem {
    const brand = brandById.get(promo.brandId);
    const campaign = campaignById.get(promo.campaignId);
    return {
      id: entry.id,
      promoId: promo.id,
      promoName: promo.namaPromo,
      campaignId: promo.campaignId,
      campaignName: campaign?.nama ?? promo.campaignId,
      brandId: promo.brandId,
      brandName: brand?.displayName ?? promo.brandId,
      status: entry.status,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy ?? null,
    };
  }
}
