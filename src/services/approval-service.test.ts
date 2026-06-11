import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type PromoScenario,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { ValidationError } from "./errors";
import { ApprovalService } from "./approval-service";

const NOW = new Date("2025-10-01T00:00:00Z");

function makeBrand(): Brand {
  return {
    id: "brand-approval",
    brandId: "APPROVAL",
    brandName: "Approval Brand",
    displayName: "Approval Brand",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeCampaign(): Campaign {
  return {
    id: "campaign-approval",
    brandId: "brand-approval",
    nama: "Approval Campaign",
    tanggalMulai: NOW,
    tanggalSelesai: NOW,
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makePromo(status: PromoStatus = PromoStatus.Draft): PromoScenario {
  return {
    id: "promo-approval",
    brandId: "brand-approval",
    campaignId: "campaign-approval",
    namaPromo: "Approval Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: NOW,
    tanggalSelesai: NOW,
    status,
    executionStatus:
      status === PromoStatus.Approved ? ExecutionStatus.Approved : null,
    rules: [],
    productRefs: [],
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("ApprovalService.changeStatus", () => {
  let persistence: InMemoryPersistence;
  let service: ApprovalService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ApprovalService({ transactionRunner: persistence });
    await persistence.brands.insert(makeBrand());
    await persistence.campaigns.insert(makeCampaign());
    await persistence.promos.insert(makePromo());
  });

  it("moves Draft to Review and appends one Approval_History entry", async () => {
    const updated = await service.changeStatus(
      "promo-approval",
      { status: PromoStatus.Review },
      "user-spv",
    );

    expect(updated.status).toBe(PromoStatus.Review);
    expect(updated.executionStatus).toBeNull();

    const history = await persistence.approvalHistory.listByPromo(
      "promo-approval",
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      promoRef: "promo-approval",
      status: PromoStatus.Review,
      changedBy: "user-spv",
    });
  });

  it("moves Review to Approved and initializes execution status", async () => {
    await service.changeStatus(
      "promo-approval",
      { status: PromoStatus.Review },
      "user-spv",
    );

    const approved = await service.changeStatus(
      "promo-approval",
      { status: PromoStatus.Approved },
      "approver",
    );

    expect(approved.status).toBe(PromoStatus.Approved);
    expect(approved.executionStatus).toBe(ExecutionStatus.Approved);

    const history = await persistence.approvalHistory.listByPromo(
      "promo-approval",
    );
    expect(history.map((entry) => entry.status)).toEqual([
      PromoStatus.Review,
      PromoStatus.Approved,
    ]);
  });

  it("moves Review to Rejected without execution status", async () => {
    await service.changeStatus(
      "promo-approval",
      { status: PromoStatus.Review },
      "user-spv",
    );

    const rejected = await service.changeStatus(
      "promo-approval",
      { status: PromoStatus.Rejected },
      "approver",
    );

    expect(rejected.status).toBe(PromoStatus.Rejected);
    expect(rejected.executionStatus).toBeNull();
  });

  it("rejects invalid transitions and preserves stored status/history", async () => {
    await expect(
      service.changeStatus(
        "promo-approval",
        { status: PromoStatus.Approved },
        "user-spv",
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const reloaded = await persistence.promos.findById("promo-approval");
    const history = await persistence.approvalHistory.listByPromo(
      "promo-approval",
    );
    expect(reloaded?.status).toBe(PromoStatus.Draft);
    expect(history).toEqual([]);
  });

  it("rolls back the status update when Approval_History insert fails", async () => {
    vi.spyOn(persistence.approvalHistory, "insert").mockRejectedValueOnce(
      new Error("history write failed"),
    );

    await expect(
      service.changeStatus(
        "promo-approval",
        { status: PromoStatus.Review },
        "user-spv",
      ),
    ).rejects.toThrowError("history write failed");

    const reloaded = await persistence.promos.findById("promo-approval");
    const history = await persistence.approvalHistory.listByPromo(
      "promo-approval",
    );
    expect(reloaded?.status).toBe(PromoStatus.Draft);
    expect(history).toEqual([]);
  });
});
