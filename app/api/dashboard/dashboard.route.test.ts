/**
 * Dashboard API Route Handler tests (Task 16.3).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  PromoStatus,
  PromoType,
  Role,
  type Brand,
  type Campaign,
  type PromoScenario,
} from "@domain/index";
import type { DashboardSummary } from "@services/index";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));

vi.mock("@/auth", async () => {
  const ac = await vi.importActual<typeof import("@/auth/access-controller")>(
    "@/auth/access-controller",
  );
  return {
    auth: mockAuth,
    AccessAction: ac.AccessAction,
    AccessResource: ac.AccessResource,
    authorize: ac.authorize,
    isAllowed: ac.isAllowed,
  };
});

import { getContainer } from "@/api/container";
import { GET as getDashboard } from "./route";

let seq = 0;

function fresh(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function asSpv(userId = "user-spv-dashboard-route"): void {
  mockAuth.mockResolvedValue({
    user: { id: userId, role: Role.SPV_Marketing },
  });
}

function asAnonymous(): void {
  mockAuth.mockResolvedValue(null);
}

function at(minutes: number): Date {
  return new Date(Date.UTC(2026, 0, 2, 10, minutes, 0));
}

async function seedDashboardData(): Promise<{
  readonly brand: Brand;
  readonly promo: PromoScenario;
}> {
  const { persistence } = await getContainer();
  const brand: Brand = {
    id: fresh("brand-dashboard-route"),
    brandId: fresh("DASHBOARD_ROUTE"),
    brandName: "Dashboard Route",
    displayName: "Dashboard Route",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: at(0),
    updatedAt: at(0),
  };
  await persistence.brands.insert(brand);

  const campaign: Campaign = {
    id: fresh("campaign-dashboard-route"),
    brandId: brand.id,
    nama: "Dashboard Campaign",
    tanggalMulai: at(1),
    tanggalSelesai: at(2),
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: at(1),
    updatedAt: at(2),
  };
  await persistence.campaigns.insert(campaign);

  const promo: PromoScenario = {
    id: fresh("promo-dashboard-route"),
    brandId: brand.id,
    campaignId: campaign.id,
    namaPromo: "Dashboard Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: at(3),
    tanggalSelesai: at(4),
    status: PromoStatus.Approved,
    executionStatus: ExecutionStatus.Approved,
    rules: [],
    productRefs: [],
    createdBy: "seed",
    createdAt: at(3),
    updatedAt: at(4),
  };
  await persistence.promos.insert(promo);

  await persistence.feedback.insert({
    id: fresh("feedback-dashboard-route"),
    promoRef: promo.id,
    message: "Unread note",
    createdByUser: "admin",
    createdDate: at(5),
    readBy: [],
  });
  await persistence.feedback.insert({
    id: fresh("feedback-dashboard-route"),
    promoRef: promo.id,
    message: "Read note",
    createdByUser: "admin",
    createdDate: at(6),
    readBy: ["user-spv-dashboard-route"],
  });
  await persistence.approvalHistory.insert({
    id: fresh("approval-dashboard-route"),
    promoRef: promo.id,
    status: PromoStatus.Approved,
    changedBy: "user-spv-dashboard-route",
    changedAt: at(7),
  });

  return { brand, promo };
}

describe("Dashboard API", () => {
  beforeEach(() => mockAuth.mockReset());

  it("returns dashboard widgets, Work Queue, and Recent Activity for the active Brand", async () => {
    const { brand, promo } = await seedDashboardData();
    asSpv();

    const response = await getDashboard(
      new Request(`http://localhost/api/dashboard?brandId=${brand.id}`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardSummary;
    expect(body.brandId).toBe(brand.id);
    expect(body.widgets.totalCampaigns).toBe(1);
    expect(body.widgets.totalPromos).toBe(1);
    expect(body.widgets.approvedPromos).toBe(1);
    expect(body.widgets.waitingForExecutionPromos).toBe(1);
    expect(body.workQueue.unreadFeedback).toBe(1);
    expect(body.recentActivity.promos[0]?.id).toBe(promo.id);
    expect(body.recentActivity.approvals[0]?.promoId).toBe(promo.id);
  });

  it("rejects unauthenticated requests", async () => {
    asAnonymous();

    const response = await getDashboard(
      new Request("http://localhost/api/dashboard", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { errorType: string };
    expect(body.errorType).toBe("unauthenticated");
  });
});
