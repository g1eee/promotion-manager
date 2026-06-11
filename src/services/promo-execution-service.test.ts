import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
  type ApprovalHistoryEntry,
  type Brand,
  type Campaign,
  type Product,
  type PromoScenario,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { ValidationError } from "./errors";
import {
  AdminExecutionBoard,
  ExecutionStatusService,
} from "./promo-execution-service";

const NOW = new Date("2025-11-01T00:00:00Z");
const APPROVED_AT = new Date("2025-11-02T03:00:00Z");

function makeBrand(id: string, brandId: string, displayName: string): Brand {
  return {
    id,
    brandId,
    brandName: displayName,
    displayName,
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeCampaign(id: string, brandId: string): Campaign {
  return {
    id,
    brandId,
    nama: `Campaign ${id}`,
    tanggalMulai: NOW,
    tanggalSelesai: NOW,
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeProduct(
  id: string,
  brandId: string,
  productId: string,
): Product {
  return {
    id,
    brandId,
    productId,
    namaProduk: `Produk ${productId}`,
    kategori: "Umum",
    hpp: 40_000,
    hargaJual: 80_000,
    status: ProductStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makePromo(
  id: string,
  brandId: string,
  campaignId: string,
  status: PromoStatus,
  productIds: readonly string[] = [],
): PromoScenario {
  return {
    id,
    brandId,
    campaignId,
    namaPromo: `Promo ${id}`,
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: NOW,
    status,
    executionStatus:
      status === PromoStatus.Approved ? ExecutionStatus.Approved : null,
    rules: [],
    productRefs: productIds.map((productId) => ({ brandId, productId })),
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function approvalHistory(promoRef: string): ApprovalHistoryEntry {
  return {
    id: `approval-${promoRef}`,
    promoRef,
    status: PromoStatus.Approved,
    changedBy: "approver",
    changedAt: APPROVED_AT,
  };
}

describe("AdminExecutionBoard.list", () => {
  let persistence: InMemoryPersistence;
  let board: AdminExecutionBoard;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    board = new AdminExecutionBoard({
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
      products: persistence.products,
      approvalHistory: persistence.approvalHistory,
    });

    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA", "Kalova"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK", "AMK"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-kalova", "brand-kalova"),
    );
    await persistence.campaigns.insert(makeCampaign("campaign-amk", "brand-amk"));
    await persistence.products.insert(
      makeProduct("product-k-1", "brand-kalova", "P-001"),
    );
    await persistence.products.insert(
      makeProduct("product-k-2", "brand-kalova", "P-002"),
    );
    await persistence.promos.insert(
      makePromo("promo-approved", "brand-kalova", "campaign-kalova", PromoStatus.Approved, [
        "P-001",
        "P-002",
      ]),
    );
    await persistence.promos.insert(
      makePromo("promo-empty", "brand-kalova", "campaign-kalova", PromoStatus.Approved),
    );
    await persistence.promos.insert(
      makePromo("promo-review", "brand-kalova", "campaign-kalova", PromoStatus.Review),
    );
    await persistence.promos.insert(
      makePromo("promo-amk", "brand-amk", "campaign-amk", PromoStatus.Approved),
    );
    await persistence.approvalHistory.insert(approvalHistory("promo-approved"));
  });

  it("returns Approved promos only, including promos with zero products", async () => {
    const rows = await board.list({ brandId: "kalova" });

    expect(rows.map((row) => row.id).sort()).toEqual([
      "promo-approved",
      "promo-empty",
    ]);
    expect(rows.find((row) => row.id === "promo-approved")).toMatchObject({
      brandName: "Kalova",
      campaignName: "Campaign campaign-kalova",
      productCount: 2,
      executionStatus: ExecutionStatus.Approved,
    });
    expect(rows.find((row) => row.id === "promo-empty")?.productCount).toBe(0);
  });

  it("uses Approval_History approved time when available", async () => {
    const rows = await board.list({ brandId: "KALOVA" });

    const approved = rows.find((row) => row.id === "promo-approved");
    expect(approved?.approvedAt.getTime()).toBe(APPROVED_AT.getTime());
  });

  it("filters by Brand and excludes Approved promos from other Brands", async () => {
    const rows = await board.list({ brandId: "AMK" });

    expect(rows.map((row) => row.id)).toEqual(["promo-amk"]);
  });
});

describe("ExecutionStatusService.update", () => {
  let persistence: InMemoryPersistence;
  let service: ExecutionStatusService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ExecutionStatusService({ transactionRunner: persistence });
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA", "Kalova"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-kalova", "brand-kalova"),
    );
    await persistence.promos.insert(
      makePromo("promo-approved", "brand-kalova", "campaign-kalova", PromoStatus.Approved),
    );
    await persistence.promos.insert(
      makePromo("promo-review", "brand-kalova", "campaign-kalova", PromoStatus.Review),
    );
  });

  it("updates execution status for an Approved promo", async () => {
    const updated = await service.update("promo-approved", {
      status: ExecutionStatus.SentToAdmin,
    });

    expect(updated.executionStatus).toBe(ExecutionStatus.SentToAdmin);
    expect(await persistence.executionStatus.get("promo-approved")).toBe(
      ExecutionStatus.SentToAdmin,
    );
  });

  it("rejects invalid execution status values", async () => {
    await expect(
      service.update("promo-approved", {
        status: "Queued" as unknown as ExecutionStatus,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects execution updates for promos that are not Approved", async () => {
    await expect(
      service.update("promo-review", {
        status: ExecutionStatus.SentToAdmin,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rolls back to the previous execution status when persistence fails", async () => {
    const originalSet = persistence.executionStatus.set.bind(
      persistence.executionStatus,
    );
    vi.spyOn(persistence.executionStatus, "set").mockImplementationOnce(
      async (promoRef, status) => {
        await originalSet(promoRef, status);
        throw new Error("execution write failed");
      },
    );

    await expect(
      service.update("promo-approved", {
        status: ExecutionStatus.MarketplaceSetup,
      }),
    ).rejects.toThrowError("execution write failed");

    expect(await persistence.executionStatus.get("promo-approved")).toBe(
      ExecutionStatus.Approved,
    );
  });
});
