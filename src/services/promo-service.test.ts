import { beforeEach, describe, expect, it } from "vitest";

import {
  BenefitType,
  BrandStatus,
  CampaignStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type Product,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { ValidationError } from "./errors";
import {
  PromoService,
  type CreatePromoInput,
  type CreatePromoWithInlineCampaignInput,
} from "./promo-service";

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

function makeProduct(
  id: string,
  brandId: string,
  productId: string,
  status: ProductStatus = ProductStatus.Active,
): Product {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    productId,
    namaProduk: `Produk ${productId}`,
    kategori: "Umum",
    hpp: 50_000,
    hargaJual: 100_000,
    status,
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
        promos: failingPromos as unknown as typeof persistence.promos,
        campaigns: persistence.campaigns,
        brands: persistence.brands,
        products: persistence.products,
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

  const inlinePromoInput = (
    overrides: Partial<CreatePromoInput> = {},
  ): CreatePromoWithInlineCampaignInput => {
    const input = promoInput(overrides);
    return {
      brandId: input.brandId,
      namaPromo: input.namaPromo,
      promoType: input.promoType,
      tanggalMulai: input.tanggalMulai,
      tanggalSelesai: input.tanggalSelesai,
    };
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

describe("PromoService.update", () => {
  let persistence: InMemoryPersistence;
  let service: PromoService;
  let promoId: string;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-1", "brand-kalova"),
    );
    await persistence.campaigns.insert(
      makeCampaign("campaign-2", "brand-kalova"),
    );
    await persistence.campaigns.insert(makeCampaign("campaign-amk", "brand-amk"));
    const promo = await service.create(promoInput(), "user-1");
    promoId = promo.id;
  });

  it("saves valid Basic Information edits and refreshes Updated At (Req 7.9, 7.11, 23.3)", async () => {
    const before = await persistence.promos.findById(promoId);
    await new Promise((r) => setTimeout(r, 2));

    const updated = await service.update(promoId, {
      campaignId: "campaign-2",
      namaPromo: "Diskon Kaluna Edited",
      promoType: PromoType.Voucher,
    });

    expect(updated.campaignId).toBe("campaign-2");
    expect(updated.namaPromo).toBe("Diskon Kaluna Edited");
    expect(updated.promoType).toBe(PromoType.Voucher);
    expect(updated.createdBy).toBe(before!.createdBy);
    expect(updated.createdAt.getTime()).toBe(before!.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before!.updatedAt.getTime(),
    );
  });

  it("rejects invalid edits and preserves previous data (Req 7.10)", async () => {
    await expect(
      service.update(promoId, {
        tanggalMulai: END,
        tanggalSelesai: START,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const reloaded = await persistence.promos.findById(promoId);
    expect(reloaded!.tanggalMulai.getTime()).toBe(START.getTime());
    expect(reloaded!.tanggalSelesai.getTime()).toBe(END.getTime());
    expect(reloaded!.namaPromo).toBe("Diskon Kaluna");
  });

  it("rejects edits that break Brand and Campaign consistency (Req 7.3, 6.12)", async () => {
    await expect(
      service.update(promoId, { campaignId: "campaign-amk" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects invalid Promo_Type edits (Req 7.7)", async () => {
    await expect(
      service.update(promoId, {
        promoType: "Mega Sale" as unknown as PromoType,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("PromoService Dynamic Rules", () => {
  let persistence: InMemoryPersistence;
  let service: PromoService;
  let promoId: string;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-1", "brand-kalova"),
    );
    const promo = await service.create(promoInput(), "user-1");
    promoId = promo.id;
  });

  it("adds a discount-percent Rule and persists it (Req 8.1, 8.2)", async () => {
    const updated = await service.addRule(promoId, {
      minQuantity: 3,
      benefitType: BenefitType.DiscountPercent,
      discountPercent: 15,
    });

    expect(updated.rules).toHaveLength(1);
    expect(updated.rules[0]).toMatchObject({
      minQuantity: 3,
      benefitType: BenefitType.DiscountPercent,
      discountPercent: 15,
      gift: null,
    });

    const reloaded = await persistence.promos.findById(promoId);
    expect(reloaded!.rules).toHaveLength(1);
  });

  it("adds a free-gift Rule and trims the gift text (Req 8.1)", async () => {
    const updated = await service.addRule(promoId, {
      minQuantity: 2,
      benefitType: BenefitType.FreeGift,
      gift: "  Tote bag  ",
    });

    expect(updated.rules[0]).toMatchObject({
      minQuantity: 2,
      benefitType: BenefitType.FreeGift,
      discountPercent: null,
      gift: "Tote bag",
    });
  });

  it("rejects min qty < 1 and preserves previous Rules (Req 8.3)", async () => {
    await expect(
      service.addRule(promoId, {
        minQuantity: 0,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: 10,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const reloaded = await persistence.promos.findById(promoId);
    expect(reloaded!.rules).toEqual([]);
  });

  it("removes a Rule by id (Req 8.4)", async () => {
    const withRule = await service.addRule(promoId, {
      minQuantity: 5,
      benefitType: BenefitType.DiscountPercent,
      discountPercent: 20,
    });

    const removed = await service.removeRule(promoId, withRule.rules[0]!.id);

    expect(removed.rules).toEqual([]);
    const reloaded = await persistence.promos.findById(promoId);
    expect(reloaded!.rules).toEqual([]);
  });
});

describe("PromoService Product Selection", () => {
  let persistence: InMemoryPersistence;
  let service: PromoService;
  let promoId: string;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new PromoService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-1", "brand-kalova"),
    );
    await persistence.products.insert(
      makeProduct("prod-1", "brand-kalova", "P-001"),
    );
    await persistence.products.insert(
      makeProduct("prod-2", "brand-kalova", "P-002"),
    );
    await persistence.products.insert(
      makeProduct("prod-old", "brand-kalova", "P-OLD", ProductStatus.Inactive),
    );
    await persistence.products.insert(
      makeProduct("prod-amk", "brand-amk", "AMK-001"),
    );
    const promo = await service.create(promoInput(), "user-1");
    promoId = promo.id;
  });

  it("lists selected and selectable products scoped to active same-Brand products (Req 9.1, 9.5, 9.11, 9.13)", async () => {
    const selection = await service.productSelection(promoId);

    expect(selection.selected).toEqual([]);
    expect(selection.selectable.map((product) => product.productId)).toEqual([
      "P-001",
      "P-002",
    ]);
  });

  it("adds multiple Product IDs and persists ProductRefs by identity (Req 9.2, 9.7, 9.10)", async () => {
    const updated = await service.addProductsById(promoId, ["P-001", "P-002"]);

    expect(updated.productRefs).toEqual([
      { brandId: "brand-kalova", productId: "P-001" },
      { brandId: "brand-kalova", productId: "P-002" },
    ]);
    const reloaded = await persistence.promos.findById(promoId);
    expect(reloaded!.productRefs).toEqual(updated.productRefs);
  });

  it("bulk-adds IDs with partition feedback and skips invalid rows without aborting (Req 9.6, 9.8, 9.9)", async () => {
    const { promo, result } = await service.bulkAddProductsById(promoId, [
      "P-001",
      "AMK-001",
      "P-MISSING",
      "P-OLD",
    ]);

    expect(result.added).toEqual(["P-001"]);
    expect(result.skippedOtherBrand).toEqual(["AMK-001"]);
    expect(result.unmatched).toEqual(["P-MISSING", "P-OLD"]);
    expect(result.skippedDuplicate).toEqual([]);
    expect(promo.productRefs).toEqual([
      { brandId: "brand-kalova", productId: "P-001" },
    ]);
  });

  it("removes selected ProductRefs by product ID (Req 9.4)", async () => {
    await service.addProductsById(promoId, ["P-001"]);

    const updated = await service.removeProduct(promoId, "P-001");

    expect(updated.productRefs).toEqual([]);
  });

  it("resolves historical Inactive selected products while keeping them unselectable for new adds (Req 9.14)", async () => {
    const promo = await service.addProductsById(promoId, ["P-001"]);
    await persistence.promos.update({
      ...promo,
      productRefs: [
        ...promo.productRefs,
        { brandId: "brand-kalova", productId: "P-OLD" },
      ],
    });

    const selection = await service.productSelection(promoId);

    expect(selection.selected.map((product) => product.productId)).toEqual([
      "P-001",
      "P-OLD",
    ]);
    expect(selection.selectable.map((product) => product.productId)).toEqual([
      "P-001",
      "P-002",
    ]);
  });
});
