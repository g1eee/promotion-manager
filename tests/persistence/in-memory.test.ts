/**
 * Unit tests for the in-memory persistence adapter.
 *
 * Focus: atomic commit/rollback semantics of `runInTransaction` and the
 * relational-integrity rules enforced by the repositories (FK ownership,
 * unique constraints, referential delete protection). These behaviors back
 * Req 17.3 (status + Approval_History atomicity), Req 18.4 (execution status
 * rollback), and Req 19.8 (Brand ownership integrity).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
} from "../../src/domain";
import type {
  ApprovalHistoryEntry,
  Brand,
  Campaign,
  Product,
  PromoScenario,
} from "../../src/domain";
import {
  ForeignKeyError,
  InMemoryPersistence,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "../../src/persistence";

const NOW = new Date("2025-01-01T00:00:00.000Z");

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "brand-1",
    brandId: "KAL",
    brandName: "Kalova",
    displayName: "Kalova",
    status: BrandStatus.Active,
    createdBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    brandId: "brand-1",
    productId: "KAL-001",
    namaProduk: "Kaluna",
    kategori: "Skincare",
    hpp: 50_000,
    hargaJual: 100_000,
    status: ProductStatus.Active,
    createdBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "campaign-1",
    brandId: "brand-1",
    nama: "Payday Sept",
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-01-31T00:00:00.000Z"),
    status: CampaignStatus.Draft,
    createdBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePromo(overrides: Partial<PromoScenario> = {}): PromoScenario {
  return {
    id: "promo-1",
    brandId: "brand-1",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-01-31T00:00:00.000Z"),
    status: PromoStatus.Draft,
    executionStatus: null,
    rules: [],
    productRefs: [],
    createdBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("InMemoryPersistence transactions", () => {
  let persistence: InMemoryPersistence;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
  });

  it("commits all mutations when the work function succeeds", async () => {
    await persistence.runInTransaction(async (uow) => {
      await uow.brands.insert(makeBrand());
      await uow.campaigns.insert(makeCampaign());
      await uow.promos.insert(makePromo());
    });

    expect(await persistence.brands.findById("brand-1")).not.toBeNull();
    expect(await persistence.campaigns.findById("campaign-1")).not.toBeNull();
    expect(await persistence.promos.findById("promo-1")).not.toBeNull();
  });

  it("rolls back every mutation when the work function throws", async () => {
    await persistence.brands.insert(makeBrand());

    await expect(
      persistence.runInTransaction(async (uow) => {
        await uow.campaigns.insert(makeCampaign());
        await uow.promos.insert(makePromo());
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // Pre-existing brand survives; everything created in the txn is undone.
    expect(await persistence.brands.findById("brand-1")).not.toBeNull();
    expect(await persistence.campaigns.findById("campaign-1")).toBeNull();
    expect(await persistence.promos.findById("promo-1")).toBeNull();
  });

  it("rolls back the promo status change when appending Approval_History fails (Req 17.3)", async () => {
    await persistence.brands.insert(makeBrand());
    await persistence.campaigns.insert(makeCampaign());
    await persistence.promos.insert(makePromo({ status: PromoStatus.Review }));

    const badEntry: ApprovalHistoryEntry = {
      id: "appr-1",
      promoRef: "promo-DOES-NOT-EXIST",
      status: PromoStatus.Approved,
      changedBy: "user-1",
      changedAt: NOW,
    };

    await expect(
      persistence.runInTransaction(async (uow) => {
        const promo = await uow.promos.findById("promo-1");
        await uow.promos.update({ ...promo!, status: PromoStatus.Approved });
        // History write fails (FK to a non-existent promo) -> whole txn aborts.
        await uow.approvalHistory.insert(badEntry);
      }),
    ).rejects.toBeInstanceOf(ForeignKeyError);

    const promo = await persistence.promos.findById("promo-1");
    expect(promo?.status).toBe(PromoStatus.Review);
    expect(await persistence.approvalHistory.listByPromo("promo-1")).toHaveLength(0);
  });

  it("preserves the previous execution status when an update transaction fails (Req 18.4)", async () => {
    await persistence.brands.insert(makeBrand());
    await persistence.campaigns.insert(makeCampaign());
    await persistence.promos.insert(
      makePromo({ status: PromoStatus.Approved, executionStatus: ExecutionStatus.Approved }),
    );

    await expect(
      persistence.runInTransaction(async (uow) => {
        await uow.executionStatus.set("promo-1", ExecutionStatus.MarketplaceSetup);
        throw new Error("save failed");
      }),
    ).rejects.toThrow("save failed");

    expect(await persistence.executionStatus.get("promo-1")).toBe(ExecutionStatus.Approved);
  });

  it("supports nested transactions where an inner rollback keeps outer work", async () => {
    await persistence.runInTransaction(async (uow) => {
      await uow.brands.insert(makeBrand());
      await persistence
        .runInTransaction(async (inner) => {
          await inner.campaigns.insert(makeCampaign());
          throw new Error("inner fail");
        })
        .catch(() => undefined);
    });

    expect(await persistence.brands.findById("brand-1")).not.toBeNull();
    expect(await persistence.campaigns.findById("campaign-1")).toBeNull();
  });
});

describe("InMemoryPersistence relational integrity", () => {
  let persistence: InMemoryPersistence;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
  });

  it("rejects a duplicate Brand ID (Req 19.2)", async () => {
    await persistence.brands.insert(makeBrand());
    await expect(
      persistence.brands.insert(makeBrand({ id: "brand-2" })),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });

  it("rejects a product whose Brand does not exist (FK ownership, Req 19.8)", async () => {
    await expect(persistence.products.insert(makeProduct())).rejects.toBeInstanceOf(
      ForeignKeyError,
    );
  });

  it("enforces UNIQUE(brandId, productId) but allows the same productId across Brands", async () => {
    await persistence.brands.insert(makeBrand());
    await persistence.brands.insert(makeBrand({ id: "brand-2", brandId: "AMK" }));
    await persistence.products.insert(makeProduct());

    // Same (brandId, productId) -> rejected.
    await expect(
      persistence.products.insert(makeProduct({ id: "product-dup" })),
    ).rejects.toBeInstanceOf(UniqueConstraintError);

    // Same productId under a different Brand -> allowed.
    const cross = await persistence.products.insert(
      makeProduct({ id: "product-2", brandId: "brand-2" }),
    );
    expect(cross.id).toBe("product-2");
  });

  it("blocks deleting a Brand that still owns data (Req 19.6)", async () => {
    await persistence.brands.insert(makeBrand());
    await persistence.products.insert(makeProduct());

    await expect(persistence.brands.delete("brand-1")).rejects.toBeInstanceOf(
      ReferentialIntegrityError,
    );
  });

  it("blocks deleting a Product referenced by a promo and allows it once unreferenced (Req 3.10)", async () => {
    await persistence.brands.insert(makeBrand());
    await persistence.campaigns.insert(makeCampaign());
    await persistence.products.insert(makeProduct());
    await persistence.promos.insert(
      makePromo({ productRefs: [{ brandId: "brand-1", productId: "KAL-001" }] }),
    );

    await expect(persistence.products.delete("product-1")).rejects.toBeInstanceOf(
      ReferentialIntegrityError,
    );

    await persistence.promos.update({ ...(await persistence.promos.findById("promo-1"))!, productRefs: [] });
    await persistence.products.delete("product-1");
    expect(await persistence.products.findById("product-1")).toBeNull();
  });

  it("isolates returned entities from the store (no aliasing)", async () => {
    await persistence.brands.insert(makeBrand());
    const fetched = await persistence.brands.findById("brand-1");
    fetched!.brandName = "MUTATED";

    const refetched = await persistence.brands.findById("brand-1");
    expect(refetched?.brandName).toBe("Kalova");
  });
});
