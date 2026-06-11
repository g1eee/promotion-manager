/**
 * Promo Execution API Route Handler tests (Task 15.4).
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
import type { ApprovedPromoListItem } from "@services/index";

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
import { GET as listExecutionBoard } from "./route";
import { PATCH as updateExecutionStatus } from "./[promoId]/route";

function asAdmin(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-admin-execution-route", role: Role.Admin_Marketplace },
  });
}

function asSpv(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-spv-execution-route", role: Role.SPV_Marketing },
  });
}

function ctx(promoId: string): { params: Promise<{ promoId: string }> } {
  return { params: Promise.resolve({ promoId }) };
}

function patchRequest(status: ExecutionStatus): Request {
  return new Request("http://localhost/api/execution/x", {
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

async function seedPromo(status: PromoStatus): Promise<PromoScenario> {
  const { persistence } = await getContainer();
  const now = new Date();
  const brand: Brand = {
    id: fresh("brand-execution-route"),
    brandId: fresh("EXECUTION_ROUTE"),
    brandName: "Execution Route",
    displayName: "Execution Route",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.brands.insert(brand);

  const campaign: Campaign = {
    id: fresh("campaign-execution-route"),
    brandId: brand.id,
    nama: "Execution Route Campaign",
    tanggalMulai: now,
    tanggalSelesai: now,
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.campaigns.insert(campaign);

  const promo: PromoScenario = {
    id: fresh("promo-execution-route"),
    brandId: brand.id,
    campaignId: campaign.id,
    namaPromo: "Execution Route Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: now,
    tanggalSelesai: now,
    status,
    executionStatus:
      status === PromoStatus.Approved ? ExecutionStatus.Approved : null,
    rules: [],
    productRefs: [],
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  return persistence.promos.insert(promo);
}

describe("Promo Execution API - board and status update", () => {
  beforeEach(() => mockAuth.mockReset());

  it("allows Admin_Marketplace to list the Approved execution board", async () => {
    const approved = await seedPromo(PromoStatus.Approved);
    await seedPromo(PromoStatus.Review);
    asAdmin();

    const response = await listExecutionBoard(
      new Request("http://localhost/api/execution", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApprovedPromoListItem[];
    expect(body.map((row) => row.id)).toContain(approved.id);
    expect(body.every((row) => row.executionStatus !== null)).toBe(true);
  });

  it("allows Admin_Marketplace to update execution status for an Approved promo", async () => {
    const approved = await seedPromo(PromoStatus.Approved);
    asAdmin();

    const response = await updateExecutionStatus(
      patchRequest(ExecutionStatus.SentToAdmin),
      ctx(approved.id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PromoScenario;
    expect(body.executionStatus).toBe(ExecutionStatus.SentToAdmin);
  });

  it("rejects execution updates for non-Approved promos", async () => {
    const review = await seedPromo(PromoStatus.Review);
    asAdmin();

    const response = await updateExecutionStatus(
      patchRequest(ExecutionStatus.SentToAdmin),
      ctx(review.id),
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as { errorType: string };
    expect(body.errorType).toBe("validation");
  });

  it("allows SPV_Marketing through the same execution endpoints", async () => {
    const approved = await seedPromo(PromoStatus.Approved);
    asSpv();

    const response = await updateExecutionStatus(
      patchRequest(ExecutionStatus.MarketplaceSetup),
      ctx(approved.id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PromoScenario;
    expect(body.executionStatus).toBe(ExecutionStatus.MarketplaceSetup);
  });
});
