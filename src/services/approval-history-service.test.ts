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
import { ApprovalService } from "./approval-service";
import { ApprovalHistoryService } from "./approval-history-service";

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

function campaign(id: string, brandId: string, nama: string): Campaign {
  return {
    id,
    brandId,
    nama,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function promo(id: string, brandId: string, campaignId: string, name: string): PromoScenario {
  return {
    id,
    brandId,
    campaignId,
    namaPromo: name,
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

describe("ApprovalHistoryService", () => {
  let persistence: InMemoryPersistence;
  let approvals: ApprovalService;
  let service: ApprovalHistoryService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await persistence.brands.insert(brand("brand-kalova", "KALOVA", "Kalova"));
    await persistence.brands.insert(brand("brand-amk", "AMK", "AMK"));
    await persistence.campaigns.insert(
      campaign("campaign-kalova", "brand-kalova", "Payday"),
    );
    await persistence.campaigns.insert(
      campaign("campaign-amk", "brand-amk", "AMK Flash"),
    );
    await persistence.promos.insert(
      promo("promo-kalova", "brand-kalova", "campaign-kalova", "Diskon Kaluna"),
    );
    await persistence.promos.insert(
      promo("promo-amk", "brand-amk", "campaign-amk", "AMK Voucher"),
    );

    approvals = new ApprovalService({ transactionRunner: persistence });
    service = new ApprovalHistoryService({
      approvalHistory: persistence.approvalHistory,
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
    });
  });

  it("lists each approval change with promo, campaign, date, and status (Req 17.1)", async () => {
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Review },
      "user-spv",
    );
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Approved },
      "user-spv",
    );

    const items = await service.list();
    expect(items).toHaveLength(2);
    // Newest-first: Approved then Review.
    expect(items.map((item) => item.status)).toEqual([
      PromoStatus.Approved,
      PromoStatus.Review,
    ]);
    expect(items[0]).toMatchObject({
      promoName: "Diskon Kaluna",
      campaignName: "Payday",
      brandName: "Kalova",
      status: PromoStatus.Approved,
      changedBy: "user-spv",
    });
    expect(items[0]?.changedAt).toBeInstanceOf(Date);
  });

  it("accumulates exactly one entry per status change", async () => {
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Review },
      "user-spv",
    );
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Rejected },
      "user-spv",
    );
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Review },
      "user-spv",
    );

    const items = await service.list();
    expect(items).toHaveLength(3);
  });

  it("scopes to the active Brand context (Global Brand Selector)", async () => {
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Review },
      "user-spv",
    );
    await approvals.changeStatus(
      "promo-amk",
      { status: PromoStatus.Review },
      "user-spv",
    );

    const kalova = await service.list({ brand: "brand-kalova" });
    expect(kalova).toHaveLength(1);
    expect(kalova[0]?.promoName).toBe("Diskon Kaluna");

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it("returns an empty list when there are no approval changes", async () => {
    const items = await service.list();
    expect(items).toEqual([]);
  });

  it("returns an empty list when the Brand filter matches no Brand", async () => {
    await approvals.changeStatus(
      "promo-kalova",
      { status: PromoStatus.Review },
      "user-spv",
    );
    const items = await service.list({ brand: "brand-tidak-ada" });
    expect(items).toEqual([]);
  });
});
