/**
 * CampaignHistoryService — reporting listing of all campaigns (Req 15).
 *
 * Lists every Campaign — including those with zero promos (Req 15.3) — projected
 * with Nama Campaign, Brand, Tanggal Dibuat, Tanggal Berjalan, Status, and
 * Jumlah Promo (Req 15.1). Supports Brand / Status / Date filters that combine
 * with AND (Req 15.2) and honours the Global Brand Selector context.
 *
 * The promo count per campaign is derived by tallying Promo_Scenario rows, so a
 * campaign with no promos still appears with a count of zero (a LEFT-JOIN-style
 * projection). Depends only on repository ports (Dependency Inversion).
 */

import type { Brand, Campaign, CampaignStatus, PromoScenario } from "../domain";
import type {
  BrandRepository,
  CampaignRepository,
  PromoScenarioRepository,
} from "../persistence";

export interface CampaignHistoryServiceDeps {
  readonly campaigns: CampaignRepository;
  readonly promos: PromoScenarioRepository;
  readonly brands: BrandRepository;
}

/** A single Campaign History row (Req 15.1). */
export interface CampaignHistoryItem {
  readonly id: string;
  readonly nama: string;
  readonly brandId: string;
  readonly brandName: string;
  /** Tanggal Dibuat. */
  readonly createdAt: Date;
  /** Tanggal Berjalan (start). */
  readonly tanggalMulai: Date;
  /** Tanggal Berjalan (end). */
  readonly tanggalSelesai: Date;
  readonly status: CampaignStatus;
  /** Jumlah Promo — zero-promo campaigns still appear (Req 15.3). */
  readonly promoCount: number;
}

/** Filter criteria (Req 15.2); supplied fields combine with AND. */
export interface CampaignHistoryFilter {
  readonly brand?: string;
  readonly status?: CampaignStatus;
  /** Inclusive lower bound on Tanggal Dibuat. */
  readonly dateFrom?: Date;
  /** Inclusive upper bound on Tanggal Dibuat. */
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

function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export class CampaignHistoryService {
  constructor(private readonly deps: CampaignHistoryServiceDeps) {}

  /**
   * List campaigns with their promo counts (Req 15.1), including zero-promo
   * campaigns (Req 15.3). Filters combine with AND (Req 15.2).
   */
  async list(filter: CampaignHistoryFilter = {}): Promise<CampaignHistoryItem[]> {
    const brands = await this.deps.brands.list();
    const resolvedBrandId = this.resolveBrandFilter(brands, filter.brand);
    if (filter.brand && filter.brand.trim() !== "" && !resolvedBrandId) {
      return [];
    }

    const campaigns = await this.deps.campaigns.list(
      resolvedBrandId ? { brandId: resolvedBrandId } : undefined,
    );
    const promos = await this.deps.promos.list(
      resolvedBrandId ? { brandId: resolvedBrandId } : undefined,
    );

    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const promoCountByCampaign = this.countPromos(promos);

    const dateFrom = filter.dateFrom ? startOfDay(filter.dateFrom) : null;
    const dateTo = filter.dateTo ? endOfDay(filter.dateTo) : null;

    const rows = campaigns
      .filter((campaign) => {
        if (filter.status && campaign.status !== filter.status) {
          return false;
        }
        if (dateFrom && campaign.createdAt.getTime() < dateFrom.getTime()) {
          return false;
        }
        if (dateTo && campaign.createdAt.getTime() > dateTo.getTime()) {
          return false;
        }
        return true;
      })
      .map((campaign) =>
        this.toItem(campaign, brandById, promoCountByCampaign),
      );

    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private countPromos(
    promos: readonly PromoScenario[],
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const promo of promos) {
      counts.set(promo.campaignId, (counts.get(promo.campaignId) ?? 0) + 1);
    }
    return counts;
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
    campaign: Campaign,
    brandById: ReadonlyMap<string, Brand>,
    promoCountByCampaign: ReadonlyMap<string, number>,
  ): CampaignHistoryItem {
    const brand = brandById.get(campaign.brandId);
    return {
      id: campaign.id,
      nama: campaign.nama,
      brandId: campaign.brandId,
      brandName: brand?.displayName ?? campaign.brandId,
      createdAt: campaign.createdAt,
      tanggalMulai: campaign.tanggalMulai,
      tanggalSelesai: campaign.tanggalSelesai,
      status: campaign.status,
      promoCount: promoCountByCampaign.get(campaign.id) ?? 0,
    };
  }
}
