import { beforeEach, describe, expect, it } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { ValidationError } from "./errors";
import { PromoService, type CreatePromoInput } from "./promo-service";

const START = new Date("2025-09-01T00:00:00Z");
const END = new Date("2025-09-30T00:00:00Z");

function makeBrand(id: string, brandId: string): Brand {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    brandName: brandId,
    displayName: brandId,
    status: BrandStatus.Active,
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

function makeCampaign(id: string, brandId: string): Campaign {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    nama: "Payday September",
    tanggalMulai: START,
    tanggalSelesai: END,
    status: CampaignStatus.Draft,
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

function promoInput(
  overrides: Partial<CreatePromoInput> = {},
): CreatePromoInput {
  return {
    brandId: "brand-kalova",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: START,
    tanggalSelesai: END,
    ...overrides,
  };
}

describe("PromoService.create", () => {
  let persistence: InMemoryPersistence;
  let service: PromoService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
    // Campaign owned by brand-kalova.
    await persistence.campaigns.insert(
      makeCampaign("campaign-1", "brand-kalova"),
    );
    // Campaign owned by a different Brand for mismatch testing.
    await persistence.campaigns.insert(makeCampaign("campaign-amk", "brand-amk"));
  });

  it("saves a valid promo with initial Draft status and audit fields (Req 7.1, 7.11, 23.2)", async () => {
    const promo = await service.create(promoInput(), "user-1");

    expect(promo.id).toBeTruthy();
    expect(promo.brandId).toBe("brand-kalova");
    expect(promo.campaignId).toBe("campaign-1");
    expect(promo.namaPromo).toBe("Diskon Kaluna");
    expect(promo.promoType).toBe(PromoType.BuyXDiscount);
    expect(promo.status).toBe(PromoStatus.Draft);
    expect(promo.executionStatus).toBeNull();
    expect(promo.createdBy).toBe("user-1");
    expect(promo.createdAt).toBeInstanceOf(Date);
    expect(promo.updatedAt).toBeInstanceOf(Date);
    expect(promo.createdAt.getTime()).toBe(promo.updatedAt.getTime());
  });

  it("rejects when not associated with an existing Campaign (Req 7.2, 6.10)", async () => {
    // Missing campaignId.
    await expect(
      service.create(promoInput({ campaignId: "" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
    // Non-existent campaignId.
    await expect(
      service.create(promoInput({ campaignId: "campaign-missing" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects when promo Brand differs from its Campaign's Brand (Req 7.3, 6.12)", async () => {
    // Promo Brand kalova but linked to a campaign owned by amk.
    await expect(
      service.create(
        promoInput({ brandId: "brand-kalova", campaignId: "campaign-amk" }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a promo whose Brand matches its Campaign's Brand (Req 7.3)", async () => {
    const promo = await service.create(
      promoInput({ brandId: "brand-amk", campaignId: "campaign-amk" }),
      "user-1",
    );
    expect(promo.brandId).toBe("brand-amk");
    expect(promo.campaignId).toBe("campaign-amk");
  });

  it("accepts Tanggal Selesai equal to Tanggal Mulai (inclusive boundary, Req 7.4)", async () => {
    const sameDay = new Date("2025-09-09T00:00:00Z");
    const promo = await service.create(
      promoInput({ tanggalMulai: sameDay, tanggalSelesai: sameDay }),
      "user-1",
    );
    expect(promo.tanggalMulai.getTime()).toBe(promo.tanggalSelesai.getTime());
  });

  it("rejects when Tanggal Selesai is earlier than Tanggal Mulai (Req 7.4)", async () => {
    await expect(
      service.create(
        promoInput({ tanggalMulai: END, tanggalSelesai: START }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing or non-existent Brand (Req 7.5)", async () => {
    await expect(
      service.create(promoInput({ brandId: "" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.create(promoInput({ brandId: "brand-missing" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an invalid Promo_Type (Req 7.6, 7.7)", async () => {
    await expect(
      service.create(
        promoInput({ promoType: "Mega Sale" as unknown as PromoType }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts every allowed Promo_Type (Req 7.6)", async () => {
    for (const promoType of [
      PromoType.BuyXDiscount,
      PromoType.BuyXGetGift,
      PromoType.Voucher,
      PromoType.FlashSale,
      PromoType.BundlePromo,
    ]) {
      const promo = await service.create(promoInput({ promoType }), "user-1");
      expect(promo.promoType).toBe(promoType);
    }
  });

  it("rejects a missing Nama Promo", async () => {
    await expect(
      service.create(promoInput({ namaPromo: "   " }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("PromoService system vs validation error distinction", () => {
  it("propagates a system error (e.g. DB failure) without wrapping it as ValidationError", async () => {
    await expect(async () => {
      const persistence = new InMemoryPersistence();
      await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
      await persistence.campaigns.insert(
        makeCampaign("campaign-1", "brand-kalova"),
      );

      // Simulate a database-connectivity failure on insert.
      const failingPromos = {
        ...persistence.promos,
        insert: async () => {
          throw new Error("DB connectivity failure");
        },
      };
      const service = new PromoService({
        promos: failingPromos as typeof persistence.promos,
        campaigns: persistence.campaigns,
        brands: persistence.brands,
      });

      try {
        await service.create(promoInput(), "user-1");
        throw new Error("expected create to throw");
      } catch (error) {
        // A system error must NOT be a ValidationError (input was valid).
        expect(error).not.toBeInstanceOf(ValidationError);
        expect((error as Error).message).toContain("DB connectivity failure");
        throw error; // satisfy rejects matcher below
      }
    }).rejects.toThrowError("DB connectivity failure");
  });
});

describe("PromoService.createWithInlineCampaign", () => {
  let persistence: InMemoryPersistence;
  let service: PromoService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
  });

  const inlineCampaign = (
    overrides: Partial<{
      brandId?: string;
      nama: string;
      tanggalMulai: Date;
      tanggalSelesai: Date;
    }> = {},
  ) => ({
    nama: "Campaign Inline September",
    tanggalMulai: START,
    tanggalSelesai: END,
    ...overrides,
  });

  const inlinePromoInput = (overrides: Partial<CreatePromoInput> = {}) => {
    const { campaignId: _ignored, ...rest } = promoInput(overrides);
    return rest;
  };

  it("creates the inline Campaign (Brand defaulted to promo Brand) and links the promo (Req 7.12, 7.13)", async () => {
    const promo = await service.createWithInlineCampaign(
      inlinePromoInput({ brandId: "brand-kalova" }),
      inlineCampaign(),
      "user-1",
    );

    // Promo is linked to a real, persisted Campaign owned by the promo's Brand.
    expect(promo.campaignId).toBeTruthy();
    expect(promo.brandId).toBe("brand-kalova");
    expect(promo.status).toBe(PromoStatus.Draft);

    const campaign = await persistence.campaigns.findById(promo.campaignId);
    expect(campaign).not.toBeNull();
    expect(campaign?.brandId).toBe("brand-kalova");
    expect(campaign?.status).toBe(CampaignStatus.Draft);
    expect(campaign?.createdBy).toBe("user-1");
    expect(campaign?.createdAt).toBeInstanceOf(Date);
    expect(campaign?.updatedAt).toBeInstanceOf(Date);
  });

  it("accepts an explicit inline Campaign Brand equal to the promo Brand (Req 7.14)", async () => {
    const promo = await service.createWithInlineCampaign(
      inlinePromoInput({ brandId: "brand-amk" }),
      inlineCampaign({ brandId: "brand-amk" }),
      "user-1",
    );
    const campaign = await persistence.campaigns.findById(promo.campaignId);
    expect(campaign?.brandId).toBe("brand-amk");
  });

  it("rejects when the inline Campaign Brand differs from the promo Brand (Req 7.14)", async () => {
    await expect(
      service.createWithInlineCampaign(
        inlinePromoInput({ brandId: "brand-kalova" }),
        inlineCampaign({ brandId: "brand-amk" }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces Campaign validations - rejects inverted Campaign date range (Req 7.13)", async () => {
    await expect(
      service.createWithInlineCampaign(
        inlinePromoInput({ brandId: "brand-kalova" }),
        inlineCampaign({ tanggalMulai: END, tanggalSelesai: START }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces Campaign validations - rejects a missing Campaign name (Req 7.13)", async () => {
    await expect(
      service.createWithInlineCampaign(
        inlinePromoInput({ brandId: "brand-kalova" }),
        inlineCampaign({ nama: "   " }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing or non-existent promo Brand (Req 7.5)", async () => {
    await expect(
      service.createWithInlineCampaign(
        inlinePromoInput({ brandId: "brand-missing" }),
        inlineCampaign(),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces promo validations - rejects an invalid Promo_Type (Req 7.6)", async () => {
    await expect(
      service.createWithInlineCampaign(
        inlinePromoInput({
          brandId: "brand-kalova",
          promoType: "Mega Sale" as unknown as PromoType,
        }),
        inlineCampaign(),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
