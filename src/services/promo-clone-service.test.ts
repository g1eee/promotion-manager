import { beforeEach, describe, expect, it } from "vitest";

import {
  BenefitType,
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type PromoScenario,
} from "../domain";
import { InMemoryPersistence, NotFoundError } from "../persistence";
import { PromoCloneService } from "./promo-clone-service";

const START = new Date("2025-09-01T00:00:00Z");
const END = new Date("2025-09-30T00:00:00Z");
const OLD_DATE = new Date("2025-01-01T00:00:00Z");

function makeBrand(): Brand {
  return {
    id: "brand-kalova",
    brandId: "KALOVA",
    brandName: "Kalova",
    displayName: "Kalova",
    status: BrandStatus.Active,
    createdBy: "user-old",
    createdAt: OLD_DATE,
    updatedAt: OLD_DATE,
  };
}

function makeCampaign(): Campaign {
  return {
    id: "campaign-1",
    brandId: "brand-kalova",
    nama: "Payday September",
    tanggalMulai: START,
    tanggalSelesai: END,
    status: CampaignStatus.Active,
    createdBy: "user-old",
    createdAt: OLD_DATE,
    updatedAt: OLD_DATE,
  };
}

function makeSourcePromo(): PromoScenario {
  return {
    id: "promo-source",
    brandId: "brand-kalova",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: START,
    tanggalSelesai: END,
    status: PromoStatus.Approved,
    executionStatus: ExecutionStatus.Approved,
    rules: [
      {
        id: "rule-1",
        minQuantity: 2,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: 10,
        gift: null,
      },
      {
        id: "rule-2",
        minQuantity: 5,
        benefitType: BenefitType.FreeGift,
        discountPercent: null,
        gift: "Tote bag",
      },
    ],
    productRefs: [
      { brandId: "brand-kalova", productId: "P-001" },
      { brandId: "brand-kalova", productId: "P-002" },
    ],
    createdBy: "user-old",
    createdAt: OLD_DATE,
    updatedAt: OLD_DATE,
  };
}

describe("PromoCloneService.clone", () => {
  let persistence: InMemoryPersistence;
  let service: PromoCloneService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoCloneService({ promos: persistence.promos });
    await persistence.brands.insert(makeBrand());
    await persistence.campaigns.insert(makeCampaign());
    await persistence.promos.insert(makeSourcePromo());
  });

  it("copies promo type, rules, and product list by Brand+Product ID while resetting status and audit fields (Req 24.1-24.4)", async () => {
    const cloned = await service.clone("promo-source", "user-cloner");

    expect(cloned.id).not.toBe("promo-source");
    expect(cloned.namaPromo).toBe("Diskon Kaluna (Copy)");
    expect(cloned.brandId).toBe("brand-kalova");
    expect(cloned.campaignId).toBe("campaign-1");
    expect(cloned.promoType).toBe(PromoType.BuyXDiscount);
    expect(cloned.tanggalMulai.getTime()).toBe(START.getTime());
    expect(cloned.tanggalSelesai.getTime()).toBe(END.getTime());
    expect(cloned.status).toBe(PromoStatus.Draft);
    expect(cloned.executionStatus).toBeNull();
    expect(cloned.createdBy).toBe("user-cloner");
    expect(cloned.createdAt.getTime()).toBeGreaterThan(OLD_DATE.getTime());
    expect(cloned.updatedAt.getTime()).toBe(cloned.createdAt.getTime());
    expect(cloned.productRefs).toEqual([
      { brandId: "brand-kalova", productId: "P-001" },
      { brandId: "brand-kalova", productId: "P-002" },
    ]);
    expect(cloned.rules).toEqual([
      {
        id: expect.any(String),
        minQuantity: 2,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: 10,
        gift: null,
      },
      {
        id: expect.any(String),
        minQuantity: 5,
        benefitType: BenefitType.FreeGift,
        discountPercent: null,
        gift: "Tote bag",
      },
    ]);
    expect(cloned.rules.map((rule) => rule.id)).not.toEqual(["rule-1", "rule-2"]);

    const persisted = await persistence.promos.findById(cloned.id);
    expect(persisted).toEqual(cloned);
  });

  it("does not mutate the source promo", async () => {
    await service.clone("promo-source", "user-cloner");

    const source = await persistence.promos.findById("promo-source");
    expect(source).toEqual(makeSourcePromo());
  });

  it("maps missing source promo to NotFoundError", async () => {
    await expect(
      service.clone("promo-missing", "user-cloner"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
