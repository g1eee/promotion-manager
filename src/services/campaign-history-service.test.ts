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
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { CampaignHistoryService } from "./campaign-history-service";

const NOW = new Date("2025-09-01T00:00:00Z");

function brand(id: string, brandId: string, name: string): Brand {
  return {
    id,
    brandId,
    brandName: name,
    displayName: name,
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function campaign(
  id: string,
  brandId: string,
  nama: string,
  status: CampaignStatus,
  createdAt: Date,
): Campaign {
  return {
    id,
    brandId,
    nama,
    tanggalMulai: new Date("2025-09-10T00:00:00Z"),
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status,
    createdBy: "seed",
    createdAt,
    updatedAt: createdAt,
  };
}

function promo(id: string, brandId: string, campaignId: string): PromoScenario {
  return {
    id,
    brandId,
    campaignId,
    namaPromo: `Promo ${id}`,
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: PromoStatus.Draft,
    executionStatus: null,
    rules: [
      {
        id: `${id}-rule`,
        minQuantity: 1,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: 10,
        gift: null,
      },
    ],
    productRefs: [],
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("CampaignHistoryService", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignHistoryService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await persistence.brands.insert(brand("brand-kalova", "KALOVA", "Kalova"));
    await persistence.brands.insert(brand("brand-amk", "AMK", "AMK"));

    await persistence.campaigns.insert(
      campaign(
        "campaign-payday",
        "brand-kalova",
        "Payday September",
        CampaignStatus.Active,
        new Date("2025-09-05T00:00:00Z"),
      ),
    );
    await persistence.campaigns.insert(
      campaign(
        "campaign-empty",
        "brand-kalova",
        "Serbu Rabu",
        CampaignStatus.Draft,
        new Date("2025-09-12T00:00:00Z"),
      ),
    );
    await persistence.campaigns.insert(
      campaign(
        "campaign-amk",
        "brand-amk",
        "AMK Flash",
        CampaignStatus.Completed,
        new Date("2025-09-20T00:00:00Z"),
      ),
    );

    // Two promos for Payday; none for Serbu Rabu (zero-promo campaign).
    await persistence.promos.insert(
      promo("promo-1", "brand-kalova", "campaign-payday"),
    );
    await persistence.promos.insert(
      promo("promo-2", "brand-kalova", "campaign-payday"),
    );

    service = new CampaignHistoryService({
      campaigns: persistence.campaigns,
      promos: persistence.promos,
      brands: persistence.brands,
    });
  });

  it("lists all campaigns with promo counts, including zero-promo campaigns (Req 15.1, 15.3)", async () => {
    const items = await service.list();

    expect(items).toHaveLength(3);
    const payday = items.find((item) => item.id === "campaign-payday");
    const empty = items.find((item) => item.id === "campaign-empty");
    expect(payday?.promoCount).toBe(2);
    expect(empty?.promoCount).toBe(0);
    expect(empty).toMatchObject({
      nama: "Serbu Rabu",
      brandName: "Kalova",
      status: CampaignStatus.Draft,
    });
  });

  it("filters by Brand context (Req 15.2)", async () => {
    const kalova = await service.list({ brand: "brand-kalova" });
    expect(kalova.map((item) => item.id).sort()).toEqual([
      "campaign-empty",
      "campaign-payday",
    ]);
  });

  it("filters by Status (Req 15.2)", async () => {
    const active = await service.list({ status: CampaignStatus.Active });
    expect(active.map((item) => item.id)).toEqual(["campaign-payday"]);
  });

  it("filters by inclusive Date Range on Tanggal Dibuat (Req 15.2)", async () => {
    const items = await service.list({
      dateFrom: new Date("2025-09-05T00:00:00Z"),
      dateTo: new Date("2025-09-12T00:00:00Z"),
    });
    // Both boundary campaigns included; AMK (2025-09-20) excluded.
    expect(items.map((item) => item.id).sort()).toEqual([
      "campaign-empty",
      "campaign-payday",
    ]);
  });

  it("combines filters with AND", async () => {
    const items = await service.list({
      brand: "brand-kalova",
      status: CampaignStatus.Draft,
    });
    expect(items.map((item) => item.id)).toEqual(["campaign-empty"]);
  });

  it("returns an empty list when the Brand filter matches no Brand", async () => {
    const items = await service.list({ brand: "brand-tidak-ada" });
    expect(items).toEqual([]);
  });
});
