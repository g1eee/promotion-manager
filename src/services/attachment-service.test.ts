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
import { AttachmentService, FeatureDisabledError } from "./attachment-service";
import { AdminExecutionBoard } from "./promo-execution-service";
import { CombinedPromoExecutionService } from "./combined-execution-service";
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
    nama: "Payday",
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function promo(status: PromoStatus = PromoStatus.Approved): PromoScenario {
  return {
    id: "promo-1",
    brandId: "brand-kalova",
    campaignId: "campaign-1",
    namaPromo: "Diskon Kaluna",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: new Date("2025-09-30T00:00:00Z"),
    status,
    executionStatus:
      status === PromoStatus.Approved ? ExecutionStatus.Approved : null,
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

async function seed(persistence: InMemoryPersistence, p = promo()): Promise<void> {
  await persistence.brands.insert(brand());
  await persistence.campaigns.insert(campaign());
  await persistence.promos.insert(p);
}

describe("AttachmentService (Req 21, feature-flagged)", () => {
  let persistence: InMemoryPersistence;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await seed(persistence);
  });

  function service(enabled: boolean): AttachmentService {
    return new AttachmentService({
      attachments: persistence.attachments,
      promos: persistence.promos,
      enabled,
    });
  }

  it("throws FeatureDisabledError when the flag is off", async () => {
    const disabled = service(false);
    await expect(
      disabled.upload("promo-1", { attachmentName: "Brief", fileUrl: "https://x/y.pdf" }, "user-spv"),
    ).rejects.toBeInstanceOf(FeatureDisabledError);
    await expect(disabled.list("promo-1")).rejects.toBeInstanceOf(
      FeatureDisabledError,
    );
    await expect(disabled.remove("att-1")).rejects.toBeInstanceOf(
      FeatureDisabledError,
    );
  });

  it("uploads attachments with full metadata and allows many per promo (Req 21.1, 21.2)", async () => {
    const enabled = service(true);
    await enabled.upload(
      "promo-1",
      { attachmentName: "Promo Brief", fileUrl: "https://x/brief.pdf" },
      "user-spv",
    );
    await enabled.upload(
      "promo-1",
      { attachmentName: "Banner", fileUrl: "https://x/banner.png" },
      "user-spv",
    );

    const list = await enabled.list("promo-1");
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      promoRef: "promo-1",
      attachmentName: "Promo Brief",
      fileUrl: "https://x/brief.pdf",
      uploadedBy: "user-spv",
    });
    expect(list[0]?.uploadDate).toBeInstanceOf(Date);
  });

  it("removes an attachment from the promo's list (Req 21.3)", async () => {
    const enabled = service(true);
    const created = await enabled.upload(
      "promo-1",
      { attachmentName: "Doc", fileUrl: "https://x/doc.pdf" },
      "user-spv",
    );

    await enabled.remove(created.id);
    expect(await enabled.list("promo-1")).toHaveLength(0);
  });

  it("rejects blank name/URL and a missing promo", async () => {
    const enabled = service(true);
    await expect(
      enabled.upload("promo-1", { attachmentName: "", fileUrl: "" }, "user-spv"),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      enabled.upload(
        "promo-missing",
        { attachmentName: "Doc", fileUrl: "https://x/doc.pdf" },
        "user-spv",
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("CombinedPromoExecutionService (Req 22, feature-flagged)", () => {
  let persistence: InMemoryPersistence;
  let board: AdminExecutionBoard;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    await seed(persistence);
    await persistence.approvalHistory.insert({
      id: "appr-1",
      promoRef: "promo-1",
      status: PromoStatus.Approved,
      changedBy: "user-spv",
      changedAt: NOW,
    });
    board = new AdminExecutionBoard({
      promos: persistence.promos,
      campaigns: persistence.campaigns,
      brands: persistence.brands,
      products: persistence.products,
      approvalHistory: persistence.approvalHistory,
    });
  });

  it("throws FeatureDisabledError when the flag is off", async () => {
    const service = new CombinedPromoExecutionService({ board, enabled: false });
    await expect(service.list()).rejects.toBeInstanceOf(FeatureDisabledError);
  });

  it("returns the combined Approved + Execution_Status view from the board source (Req 22.1, 22.2, 22.3)", async () => {
    const service = new CombinedPromoExecutionService({ board, enabled: true });
    const rows = await service.list();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "promo-1",
      namaPromo: "Diskon Kaluna",
      executionStatus: ExecutionStatus.Approved,
    });
    // Source equivalence: combined view equals the board projection (Req 22.3).
    const boardRows = await board.list();
    expect(rows).toEqual(boardRows);
  });
});
