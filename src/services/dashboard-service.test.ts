import { describe, expect, it } from "vitest";

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
import { DashboardService } from "./dashboard-service";

let seq = 0;

function id(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function at(minutes: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 9, minutes, 0));
}

function makeBrand(name: string): Brand {
  const now = at(0);
  return {
    id: `brand-${name.toLowerCase()}`,
    brandId: name.toUpperCase(),
    brandName: name,
    displayName: name,
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
}

function makeCampaign(
  brand: Brand,
  name: string,
  updatedAt: Date,
): Campaign {
  return {
    id: id("campaign"),
    brandId: brand.id,
    nama: name,
    tanggalMulai: at(1),
    tanggalSelesai: at(2),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: at(1),
    updatedAt,
  };
}

function makePromo(input: {
  readonly brand: Brand;
  readonly campaign: Campaign;
  readonly name: string;
  readonly status: PromoStatus;
  readonly updatedAt: Date;
  readonly executionStatus?: ExecutionStatus | null;
}): PromoScenario {
  return {
    id: id("promo"),
    brandId: input.brand.id,
    campaignId: input.campaign.id,
    namaPromo: input.name,
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: at(3),
    tanggalSelesai: at(4),
    status: input.status,
    executionStatus: input.executionStatus ?? null,
    rules: [],
    productRefs: [],
    createdBy: "seed",
    createdAt: at(3),
    updatedAt: input.updatedAt,
  };
}

function serviceFor(persistence: InMemoryPersistence): DashboardService {
  return new DashboardService({
    brands: persistence.brands,
    campaigns: persistence.campaigns,
    promos: persistence.promos,
    feedback: persistence.feedback,
    approvalHistory: persistence.approvalHistory,
  });
}

describe("DashboardService", () => {
  it("recomputes widgets and Work Queue from current data with Brand filtering", async () => {
    const persistence = new InMemoryPersistence();
    const service = serviceFor(persistence);
    const alpha = makeBrand("Alpha");
    const beta = makeBrand("Beta");
    await persistence.brands.insert(alpha);
    await persistence.brands.insert(beta);

    const alphaCampaign = await persistence.campaigns.insert(
      makeCampaign(alpha, "Alpha Payday", at(10)),
    );
    await persistence.campaigns.insert(
      makeCampaign(alpha, "Alpha Flash", at(11)),
    );
    const betaCampaign = await persistence.campaigns.insert(
      makeCampaign(beta, "Beta Payday", at(12)),
    );

    const draft = await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Draft",
        status: PromoStatus.Draft,
        updatedAt: at(13),
      }),
    );
    const review = await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Review",
        status: PromoStatus.Review,
        updatedAt: at(14),
      }),
    );
    const approvedWaiting = await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Approved",
        status: PromoStatus.Approved,
        executionStatus: ExecutionStatus.Approved,
        updatedAt: at(15),
      }),
    );
    await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Approved Done",
        status: PromoStatus.Approved,
        executionStatus: ExecutionStatus.Completed,
        updatedAt: at(16),
      }),
    );
    await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Active",
        status: PromoStatus.Active,
        updatedAt: at(17),
      }),
    );
    await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Rejected",
        status: PromoStatus.Rejected,
        updatedAt: at(18),
      }),
    );
    await persistence.promos.insert(
      makePromo({
        brand: alpha,
        campaign: alphaCampaign,
        name: "Alpha Completed",
        status: PromoStatus.Completed,
        updatedAt: at(19),
      }),
    );
    const betaReview = await persistence.promos.insert(
      makePromo({
        brand: beta,
        campaign: betaCampaign,
        name: "Beta Review",
        status: PromoStatus.Review,
        updatedAt: at(20),
      }),
    );

    await persistence.feedback.insert({
      id: id("feedback"),
      promoRef: review.id,
      message: "Needs margin check",
      createdByUser: "admin",
      createdDate: at(21),
      readBy: [],
    });
    await persistence.feedback.insert({
      id: id("feedback"),
      promoRef: approvedWaiting.id,
      message: "Marketplace note",
      createdByUser: "admin",
      createdDate: at(22),
      readBy: ["other-user"],
    });
    await persistence.feedback.insert({
      id: id("feedback"),
      promoRef: betaReview.id,
      message: "Other brand",
      createdByUser: "admin",
      createdDate: at(23),
      readBy: [],
    });

    let summary = await service.summary({
      brandId: "alpha",
      userId: "current-user",
    });

    expect(summary.widgets).toMatchObject({
      totalCampaigns: 2,
      totalPromos: 7,
      draftPromos: 1,
      reviewPromos: 1,
      approvedPromos: 2,
      rejectedPromos: 1,
      activePromos: 1,
      completedPromos: 1,
      pendingReviewPromos: 1,
      waitingForExecutionPromos: 1,
    });
    expect(summary.workQueue).toEqual({
      pendingReviews: 1,
      rejectedPromos: 1,
      unreadFeedback: 2,
      waitingForExecution: 1,
    });

    await persistence.promos.update({
      ...draft,
      status: PromoStatus.Review,
      updatedAt: at(30),
    });
    summary = await service.summary({
      brandId: "alpha",
      userId: "current-user",
    });

    expect(summary.widgets.draftPromos).toBe(0);
    expect(summary.widgets.reviewPromos).toBe(2);
    expect(summary.workQueue.pendingReviews).toBe(2);
  });

  it("returns top-N recent campaigns, promos, and approvals by recency", async () => {
    const persistence = new InMemoryPersistence();
    const service = serviceFor(persistence);
    const brand = makeBrand("Gamma");
    await persistence.brands.insert(brand);

    const olderCampaign = await persistence.campaigns.insert(
      makeCampaign(brand, "Older Campaign", at(5)),
    );
    const newerCampaign = await persistence.campaigns.insert(
      makeCampaign(brand, "Newer Campaign", at(25)),
    );
    const newestCampaign = await persistence.campaigns.insert(
      makeCampaign(brand, "Newest Campaign", at(35)),
    );

    const olderPromo = await persistence.promos.insert(
      makePromo({
        brand,
        campaign: olderCampaign,
        name: "Older Promo",
        status: PromoStatus.Draft,
        updatedAt: at(6),
      }),
    );
    const newerPromo = await persistence.promos.insert(
      makePromo({
        brand,
        campaign: newerCampaign,
        name: "Newer Promo",
        status: PromoStatus.Review,
        updatedAt: at(26),
      }),
    );
    const newestPromo = await persistence.promos.insert(
      makePromo({
        brand,
        campaign: newestCampaign,
        name: "Newest Promo",
        status: PromoStatus.Approved,
        updatedAt: at(36),
      }),
    );

    await persistence.approvalHistory.insert({
      id: id("approval"),
      promoRef: olderPromo.id,
      status: PromoStatus.Review,
      changedBy: "spv",
      changedAt: at(7),
    });
    await persistence.approvalHistory.insert({
      id: id("approval"),
      promoRef: newerPromo.id,
      status: PromoStatus.Rejected,
      changedBy: "spv",
      changedAt: at(27),
    });
    await persistence.approvalHistory.insert({
      id: id("approval"),
      promoRef: newestPromo.id,
      status: PromoStatus.Approved,
      changedBy: "spv",
      changedAt: at(37),
    });

    const summary = await service.summary({
      brandId: brand.id,
      userId: "spv",
      limit: 2,
    });

    expect(summary.recentActivity.campaigns.map((item) => item.name)).toEqual([
      "Newest Campaign",
      "Newer Campaign",
    ]);
    expect(summary.recentActivity.promos.map((item) => item.name)).toEqual([
      "Newest Promo",
      "Newer Promo",
    ]);
    expect(summary.recentActivity.approvals.map((item) => item.promoName)).toEqual([
      "Newest Promo",
      "Newer Promo",
    ]);
  });
});
