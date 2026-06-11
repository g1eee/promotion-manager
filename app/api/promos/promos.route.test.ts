/**
 * Promo Scenario API Route Handler tests for clone (Task 12.2).
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
import { POST as clonePromo } from "./[id]/clone/route";

function asSpv(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-spv-route", role: Role.SPV_Marketing },
  });
}

function asAdmin(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-admin-route", role: Role.Admin_Marketplace },
  });
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

let unique = 0;
function fresh(prefix: string): string {
  unique += 1;
  return `${prefix}-${Date.now()}-${unique}`;
}

async function seedPromo(): Promise<PromoScenario> {
  const { persistence } = await getContainer();
  const now = new Date();
  const brand: Brand = {
    id: fresh("brand-clone-route"),
    brandId: fresh("CLONE_ROUTE"),
    brandName: "Clone Route",
    displayName: "Clone Route",
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.brands.insert(brand);

  const campaign: Campaign = {
    id: fresh("campaign-clone-route"),
    brandId: brand.id,
    nama: "Clone Route Campaign",
    tanggalMulai: now,
    tanggalSelesai: now,
    status: CampaignStatus.Active,
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  await persistence.campaigns.insert(campaign);

  const promo: PromoScenario = {
    id: fresh("promo-clone-route"),
    brandId: brand.id,
    campaignId: campaign.id,
    namaPromo: "Route Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: now,
    tanggalSelesai: now,
    status: PromoStatus.Approved,
    executionStatus: null,
    rules: [],
    productRefs: [{ brandId: brand.id, productId: "P-ROUTE" }],
    createdBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
  return persistence.promos.insert(promo);
}

describe("Promo clone API - RBAC and creation", () => {
  beforeEach(() => mockAuth.mockReset());

  it("allows SPV_Marketing to clone and stamps createdBy", async () => {
    const source = await seedPromo();
    asSpv();

    const response = await clonePromo(
      new Request("http://localhost/api/promos/x/clone", { method: "POST" }),
      ctx(source.id),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as PromoScenario;
    expect(body.id).not.toBe(source.id);
    expect(body.createdBy).toBe("user-spv-route");
    expect(body.status).toBe(PromoStatus.Draft);
    expect(body.productRefs).toEqual(source.productRefs);
  });

  it("denies Admin_Marketplace clone", async () => {
    const source = await seedPromo();
    asAdmin();

    const response = await clonePromo(
      new Request("http://localhost/api/promos/x/clone", { method: "POST" }),
      ctx(source.id),
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { errorType: string };
    expect(body.errorType).toBe("access_denied");
  });
});
