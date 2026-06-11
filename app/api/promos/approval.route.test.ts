/**
 * Promo approval API Route Handler tests (Task 14.2).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  PromoStatus,
  PromoType,
  Role,
  type Brand,
  type Campaign,
  type PromoScenario,
} from "@domain/index";

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
import { PATCH as changeApprovalStatus } from "./[id]/approval/route";

function asSpv(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-spv-approval-route", role: Role.SPV_Marketing },
  });
}

function asAdmin(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-admin-approval-route", role: Role.Admin_Marketplace },
  });
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function request(status: PromoStatus): Request {
  return new Request("http://localhost/api/promos/x/approval", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

let unique = 0;
function fresh(prefix: string): string {
  unique += 1;
  return `${prefix}-${Date.now()}-${unique}`;
}

async function seedPromo(
  status: PromoStatus = PromoStatus.Draft,
): Promise<PromoScenario> {
  const { persistence } = await getContainer();
  const now = new Date();
  const brand: Brand = {
    id: fresh("brand-approval-route"),
    brandId: fresh("APPROVAL_ROUTE"),
    brandName: "Approval Route",
    displayName: "Approval Route",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.brands.insert(brand);

  const campaign: Campaign = {
    id: fresh("campaign-approval-route"),
    brandId: brand.id,
    nama: "Approval Route Campaign",
    tanggalMulai: now,
    tanggalSelesai: now,
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.campaigns.insert(campaign);

  const promo: PromoScenario = {
    id: fresh("promo-approval-route"),
    brandId: brand.id,
    campaignId: campaign.id,
    namaPromo: "Approval Route Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: now,
    tanggalSelesai: now,
    status,
    executionStatus: null,
    rules: [],
    productRefs: [],
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  return persistence.promos.insert(promo);
}

describe("Promo approval API - RBAC and workflow", () => {
  beforeEach(() => mockAuth.mockReset());

  it("allows SPV_Marketing to submit a Draft promo for Review", async () => {
    const source = await seedPromo();
    asSpv();

    const response = await changeApprovalStatus(
      request(PromoStatus.Review),
      ctx(source.id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PromoScenario;
    expect(body.status).toBe(PromoStatus.Review);

    const { persistence } = await getContainer();
    const history = await persistence.approvalHistory.listByPromo(source.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.changedBy).toBe("user-spv-approval-route");
  });

  it("denies Admin_Marketplace approval changes", async () => {
    const source = await seedPromo();
    asAdmin();

    const response = await changeApprovalStatus(
      request(PromoStatus.Review),
      ctx(source.id),
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { errorType: string };
    expect(body.errorType).toBe("access_denied");
  });

  it("maps invalid approval transitions to validation responses", async () => {
    const source = await seedPromo();
    asSpv();

    const response = await changeApprovalStatus(
      request(PromoStatus.Approved),
      ctx(source.id),
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as { errorType: string };
    expect(body.errorType).toBe("validation");
  });
});
