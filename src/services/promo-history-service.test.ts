import { beforeEach, describe, expect, it } from "vitest";

import {
  BenefitType,
  BrandStatus,
  CampaignStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type PromoScenario,
  type ProductRef,
  type Rule,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { PromoHistoryService } from "./promo-history-service";

const OLD = new Date("2025-01-01T00:00:00Z");

function brand(id: string, brandId: string, name: string): Brand {
  return {
    id,
    brandId,
    brandName: name,
    displayName: name,
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: OLD,
    updatedAt: OLD,
  };
}

function campaign(id: string, brandId: string, nama: string): Campaign {
  return {
    id,
    brandId,
    nama,
    tanggalMulai: new Date("2025-09-01T00:00:00Z"),
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: OLD,
    updatedAt: OLD,
  };
}

const RULE: Rule = {
  id: "rule-1",
  minQuantity: 1,
  benefitType: BenefitType.DiscountPercent,
  discountPercent: 10,
  gift: null,
};

function promo(overrides: {
  id: string;
  brandId: string;
  campaignId: string;
  namaPromo: string;
  promoType?: PromoType;
  status?: PromoStatus;
  createdAt: Date;
  productRefs?: ProductRef[];
}): PromoScenario {
  return {
    id: overrides.id,
    brandId: overrides.brandId,
    campaignId: overrides.campaignId,
    namaPromo: overrides.namaPromo,
    promoType: overrides.promoType ?? PromoType.BuyXDiscount,
    tanggalMulai: new Date("2025-09-01T00:00:00Z"),
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: overrides.status ?? PromoStatus.Draft,
    executionStatus: null,
    rules: [RULE],
    productRefs: overrides.productRefs ?? [],
    createdBy: "seed",
    createdAt: overrides.createdAt,
    updatedAt: overrides.createdAt,
  };
}

describe("PromoHistoryService", () => {
  let persistence: InMemoryPersistence;
  let service: PromoHistoryService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await persistence.brands.insert(brand("brand-kalova", "KALOVA", "Kalova"));
    await persistence.brands.insert(brand("brand-amk", "AMK", "AMK"));
    await persistence.campaigns.insert(
      campaign("campaign-payday", "brand-kalova", "Payday September"),
    );
    await persistence.campaigns.insert(
      campaign("campaign-serbu", "brand-kalova", "Serbu Rabu"),
    );
    await persistence.campaigns.insert(
      campaign("campaign-amk", "brand-amk", "AMK Flash"),
    );

    await persistence.promos.insert(
      promo({
        id: "promo-1",
        brandId: "brand-kalova",
        campaignId: "campaign-payday",
        namaPromo: "Diskon Kaluna Payday",
        promoType: PromoType.BuyXDiscount,
        status: PromoStatus.Approved,
        createdAt: new Date("2025-09-05T00:00:00Z"),
        productRefs: [
          { brandId: "brand-kalova", productId: "P-001" },
          { brandId: "brand-kalova", productId: "P-002" },
        ],
      }),
    );
    await persistence.promos.insert(
      promo({
        id: "promo-2",
        brandId: "brand-kalova",
        campaignId: "campaign-serbu",
        namaPromo: "Flash Sale Serbu",
        promoType: PromoType.FlashSale,
        status: PromoStatus.Draft,
        createdAt: new Date("2025-09-10T00:00:00Z"),
        productRefs: [{ brandId: "brand-kalova", productId: "P-003" }],
      }),
    );
    await persistence.promos.insert(
      promo({
        id: "promo-3",
        brandId: "brand-amk",
        campaignId: "campaign-amk",
        namaPromo: "AMK Voucher",
        promoType: PromoType.Voucher,
        status: PromoStatus.Approved,
        createdAt: new Date("2025-09-15T00:00:00Z"),
      }),
    );

    service = new PromoHistoryService({
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
    });
  });

  it("lists all historical promos across campaigns with the correct product count (Req 16.1)", async () => {
    const items = await service.list();

    expect(items).toHaveLength(3);
    // Newest first by Tanggal Dibuat.
    expect(items.map((item) => item.id)).toEqual([
      "promo-3",
      "promo-2",
      "promo-1",
    ]);
    const payday = items.find((item) => item.id === "promo-1");
    expect(payday).toMatchObject({
      namaPromo: "Diskon Kaluna Payday",
      brandName: "Kalova",
      campaignName: "Payday September",
      promoType: PromoType.BuyXDiscount,
      status: PromoStatus.Approved,
      productCount: 2,
    });
  });

  it("matches keyword as a case-insensitive substring of Nama Promo (Req 16.2)", async () => {
    const items = await service.search({ keyword: "serbu" });
    expect(items.map((item) => item.id)).toEqual(["promo-2"]);
  });

  it("combines multiple filters with AND (Req 16.3, 16.4)", async () => {
    const items = await service.search({
      brand: "brand-kalova",
      status: PromoStatus.Approved,
      promoType: PromoType.BuyXDiscount,
    });
    expect(items.map((item) => item.id)).toEqual(["promo-1"]);

    // AND that excludes everything yields an empty list.
    const none = await service.search({
      brand: "brand-kalova",
      promoType: PromoType.Voucher,
    });
    expect(none).toEqual([]);
  });

  it("filters by Campaign across the same Brand", async () => {
    const items = await service.search({ campaign: "campaign-serbu" });
    expect(items.map((item) => item.id)).toEqual(["promo-2"]);
  });

  it("applies an inclusive Date Range on Tanggal Dibuat (Req 16.5)", async () => {
    const items = await service.search({
      dateFrom: new Date("2025-09-10T00:00:00Z"),
      dateTo: new Date("2025-09-15T00:00:00Z"),
    });
    // Both boundary promos (2025-09-10 and 2025-09-15) are included.
    expect(items.map((item) => item.id)).toEqual(["promo-3", "promo-2"]);
  });

  it("returns an empty list when nothing matches (Req 16.6)", async () => {
    const items = await service.search({ keyword: "tidak-ada-promo-ini" });
    expect(items).toEqual([]);
  });

  it("returns an empty list when the Brand filter matches no Brand (Req 16.6)", async () => {
    const items = await service.search({ brand: "brand-tidak-dikenal" });
    expect(items).toEqual([]);
  });

  it("restores the full cross-campaign listing on resetFilters (Req 16.7)", async () => {
    const reset = await service.resetFilters();
    expect(reset).toHaveLength(3);
    expect(reset.map((item) => item.id)).toEqual([
      "promo-3",
      "promo-2",
      "promo-1",
    ]);
  });

  it("scopes the listing to the active Brand context when provided (Req 16.3)", async () => {
    const items = await service.list({ brand: "brand-kalova" });
    expect(items.map((item) => item.id).sort()).toEqual(["promo-1", "promo-2"]);
  });
});
