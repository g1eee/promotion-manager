/**
 * PromoHistoryService — cross-campaign promo history listing & search (Req 16).
 *
 * Promo History surfaces ALL historical Promo_Scenario across campaigns and
 * provides keyword search combined with multi-criteria filtering. The same
 * projection (one {@link PromoHistoryItem} per promo, with the correct product
 * count) backs both `list()` and `search()`; `resetFilters()` is an alias for
 * the unfiltered listing (Req 16.7).
 *
 * Filter semantics:
 * - Keyword matches a case-insensitive substring of Nama Promo (Req 16.2).
 * - Brand / Campaign / Promo_Type / Status / Date Range combine with AND
 *   (Req 16.3, 16.4) — every supplied criterion must hold.
 * - Date Range filters on Tanggal Dibuat (`createdAt`) and is INCLUSIVE on both
 *   the start and end boundary (Req 16.5).
 * - When nothing matches, an empty list is returned (Req 16.6); the UI renders
 *   the "no results" empty state.
 *
 * Brand resolution mirrors the other listing services so the Global Brand
 * Selector value (which may be a surrogate id, business Brand ID, or display
 * name) resolves to the owning Brand consistently.
 */

import { PromoStatus, PromoType } from "../domain";
import type { Brand, Campaign, PromoScenario } from "../domain";
import type {
  BrandRepository,
  CampaignRepository,
  PromoScenarioRepository,
} from "../persistence";

export interface PromoHistoryServiceDeps {
  readonly promos: PromoScenarioRepository;
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
}

/** A single Promo History row (Req 16.1). */
export interface PromoHistoryItem {
  readonly id: string;
  readonly namaPromo: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly promoType: PromoType;
  readonly status: PromoStatus;
  /** Jumlah Produk: number of referenced products (Req 16.1). */
  readonly productCount: number;
  /** Tanggal Dibuat — the basis for Date Range filtering (Req 16.5). */
  readonly createdAt: Date;
}

/**
 * Search/filter criteria (Req 16.2–16.5). Every field is optional; omitted or
 * blank fields impose no constraint. Supplied fields combine with AND.
 */
export interface PromoHistorySearch {
  /** Case-insensitive substring match on Nama Promo (Req 16.2). */
  readonly keyword?: string;
  /** Active Brand context / Brand filter (Req 16.3). */
  readonly brand?: string;
  /** Campaign surrogate id filter (Req 16.3). */
  readonly campaign?: string;
  /** Promo_Type filter (Req 16.3). */
  readonly promoType?: PromoType;
  /** Status filter (Req 16.3). */
  readonly status?: PromoStatus;
  /** Inclusive lower bound on Tanggal Dibuat (Req 16.5). */
  readonly dateFrom?: Date;
  /** Inclusive upper bound on Tanggal Dibuat (Req 16.5). */
  readonly dateTo?: Date;
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

/** Start-of-day for an inclusive lower Date Range bound. */
function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** End-of-day for an inclusive upper Date Range bound (Req 16.5). */
function endOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export class PromoHistoryService {
  constructor(private readonly deps: PromoHistoryServiceDeps) {}

  /**
   * List every historical Promo_Scenario across campaigns (Req 16.1). When a
   * Brand context is supplied it scopes the listing to that Brand; otherwise it
   * spans all Brands.
   */
  async list(filter: { brand?: string } = {}): Promise<PromoHistoryItem[]> {
    return this.search({ brand: filter.brand });
  }

  /**
   * Restore the full cross-campaign listing after filters/keyword are cleared
   * (Req 16.7). Equivalent to {@link list} with no Brand scope.
   */
  async resetFilters(): Promise<PromoHistoryItem[]> {
    return this.search({});
  }

  /**
   * Search and filter promo history (Req 16.2–16.6). All criteria combine with
   * AND; an empty result set signals "no results" to the UI (Req 16.6).
   */
  async search(search: PromoHistorySearch): Promise<PromoHistoryItem[]> {
    const brands = await this.deps.brands.list();
    const resolvedBrandId = this.resolveBrandFilter(brands, search.brand);
    // A Brand filter that matches no Brand yields no results (Req 16.6).
    if (search.brand && search.brand.trim() !== "" && !resolvedBrandId) {
      return [];
    }

    const promos = await this.deps.promos.list(
      resolvedBrandId
        ? { brandId: resolvedBrandId, status: search.status }
        : { status: search.status },
    );
    const campaigns = await this.deps.campaigns.list(
      resolvedBrandId ? { brandId: resolvedBrandId } : undefined,
    );

    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign]),
    );

    const keyword = search.keyword ? normalizeKey(search.keyword) : "";
    const dateFrom = search.dateFrom ? startOfDay(search.dateFrom) : null;
    const dateTo = search.dateTo ? endOfDay(search.dateTo) : null;

    const rows = promos
      .filter((promo) => this.matches(promo, { keyword, dateFrom, dateTo, search }))
      .map((promo) => this.toItem(promo, brandById, campaignById));

    // Newest first by Tanggal Dibuat for a stable, intuitive ordering.
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private matches(
    promo: PromoScenario,
    ctx: {
      readonly keyword: string;
      readonly dateFrom: Date | null;
      readonly dateTo: Date | null;
      readonly search: PromoHistorySearch;
    },
  ): boolean {
    const { keyword, dateFrom, dateTo, search } = ctx;

    if (keyword !== "" && !normalizeKey(promo.namaPromo).includes(keyword)) {
      return false;
    }
    if (search.campaign && promo.campaignId !== search.campaign) {
      return false;
    }
    if (search.promoType && promo.promoType !== search.promoType) {
      return false;
    }
    // Status already applied at the repository level when supplied; re-check
    // defensively so a repository that ignores the filter stays correct.
    if (search.status && promo.status !== search.status) {
      return false;
    }
    if (dateFrom && promo.createdAt.getTime() < dateFrom.getTime()) {
      return false;
    }
    if (dateTo && promo.createdAt.getTime() > dateTo.getTime()) {
      return false;
    }
    return true;
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
    promo: PromoScenario,
    brandById: ReadonlyMap<string, Brand>,
    campaignById: ReadonlyMap<string, Campaign>,
  ): PromoHistoryItem {
    const brand = brandById.get(promo.brandId);
    const campaign = campaignById.get(promo.campaignId);
    return {
      id: promo.id,
      namaPromo: promo.namaPromo,
      brandId: promo.brandId,
      brandName: brand?.displayName ?? promo.brandId,
      campaignId: promo.campaignId,
      campaignName: campaign?.nama ?? promo.campaignId,
      promoType: promo.promoType,
      status: promo.status,
      productCount: promo.productRefs.length,
      createdAt: promo.createdAt,
    };
  }
}
