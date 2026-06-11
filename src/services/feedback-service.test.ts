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
import { InMemoryPersistence, NotFoundError } from "../persistence";
import { FeedbackService } from "./feedback-service";
import { ValidationError } from "./errors";

const NOW = new Date("2025-09-01T00:00:00Z");

function brand(): Brand {
  return {
    id: "brand-kalova",
    brandId: "KALOVA",
    brandName: "Kalova",
    displayName: "Kalova",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function campaign(): Campaign {
  return {
    id: "campaign-1",
    brandId: "brand-kalova",
    nama: "Payday September",
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function promo(): PromoScenario {
  return {
    id: "promo-1",
    brandId: "brand-kalova",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: PromoStatus.Approved,
    executionStatus: null,
    rules: [
      {
        id: "rule-1",
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

describe("FeedbackService", () => {
  let persistence: InMemoryPersistence;
  let service: FeedbackService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await persistence.brands.insert(brand());
    await persistence.campaigns.insert(campaign());
    await persistence.promos.insert(promo());

    service = new FeedbackService({
      feedback: persistence.feedback,
      promos: persistence.promos,
    });
  });

  it("creates a structured Feedback_Record with full fields (Req 14.4)", async () => {
    const record = await service.add(
      "promo-1",
      { message: "Tolong cek margin produk A." },
      "user-spv",
    );

    expect(record).toMatchObject({
      promoRef: "promo-1",
      message: "Tolong cek margin produk A.",
      createdByUser: "user-spv",
    });
    expect(record.id).toBeTruthy();
    expect(record.createdDate).toBeInstanceOf(Date);
  });

  it("allows feedback creation by either role with access (two-way thread, Req 1.4, 1.5)", async () => {
    await service.add("promo-1", { message: "Dari SPV" }, "user-spv");
    await service.add("promo-1", { message: "Dari Admin" }, "user-admin");

    const thread = await service.list("promo-1");
    expect(thread.map((record) => record.createdByUser)).toEqual([
      "user-spv",
      "user-admin",
    ]);
  });

  it("keeps many records per promo, oldest-first, with creator and date (Req 14.4, 14.5, 14.6)", async () => {
    await service.add("promo-1", { message: "Pertama" }, "user-spv");
    await service.add("promo-1", { message: "Kedua" }, "user-admin");
    await service.add("promo-1", { message: "Ketiga" }, "user-spv");

    const thread = await service.list("promo-1");
    expect(thread).toHaveLength(3);
    expect(thread.map((record) => record.message)).toEqual([
      "Pertama",
      "Kedua",
      "Ketiga",
    ]);
    for (const record of thread) {
      expect(record.createdByUser).toBeTruthy();
      expect(record.createdDate).toBeInstanceOf(Date);
      expect(record.promoRef).toBe("promo-1");
    }
  });

  it("rejects a blank message", async () => {
    await expect(
      service.add("promo-1", { message: "   " }, "user-spv"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects feedback for a missing promo", async () => {
    await expect(
      service.add("promo-missing", { message: "halo" }, "user-spv"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects listing feedback for a missing promo", async () => {
    await expect(service.list("promo-missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
