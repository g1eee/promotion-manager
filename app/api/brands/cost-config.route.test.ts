/**
 * Cost Configuration API Route Handler tests (Task 7.2).
 *
 * Exercises RBAC and atomic validation for
 * `/api/brands/[id]/cost-config` against the shared in-memory container.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrandStatus, Role } from "@domain/enums";
import type { Brand } from "@domain/types";
import {
  COST_COMPONENT_KEYS,
  type CostComponents,
} from "@services/index";

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
import { GET as getCostConfig, PUT as updateCostConfig } from "./[id]/cost-config/route";

function asSpv(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-spv", role: Role.SPV_Marketing },
  });
}

function asAdmin(): void {
  mockAuth.mockResolvedValue({
    user: { id: "user-admin", role: Role.Admin_Marketplace },
  });
}

function putReq(body: unknown): Request {
  return new Request("http://localhost/api/brands/x/cost-config", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
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

function components(overrides: Partial<CostComponents> = {}): CostComponents {
  const base = Object.fromEntries(
    COST_COMPONENT_KEYS.map((key) => [key, 5]),
  ) as CostComponents;
  return { ...base, ...overrides };
}

async function seedBrand(label: string): Promise<Brand> {
  const { persistence } = await getContainer();
  const now = new Date();
  const brand: Brand = {
    id: fresh(`brand-${label}`),
    brandId: fresh(label.toUpperCase()),
    brandName: label,
    displayName: label,
    status: BrandStatus.Active,
    createdBy: "user-spv",
    createdAt: now,
    updatedAt: now,
  };
  return persistence.brands.insert(brand);
}

describe("Cost Configuration API - RBAC and defaults (Req 1.2, 1.6, 4.1)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("returns an inactive zeroed config before a Brand is configured", async () => {
    const brand = await seedBrand("Cost Route Default");
    asSpv();

    const response = await getCostConfig(new Request("http://localhost"), ctx(brand.id));
    expect(response.status).toBe(200);
    const body = (await response.json()) as CostComponents & { isActive: boolean };
    expect(body.isActive).toBe(false);
    for (const key of COST_COMPONENT_KEYS) {
      expect(body[key]).toBe(0);
    }
  });

  it("denies Admin_Marketplace from reading and updating Cost Configuration", async () => {
    const brand = await seedBrand("Cost Route RBAC");
    asAdmin();

    const readDenied = await getCostConfig(new Request("http://localhost"), ctx(brand.id));
    expect(readDenied.status).toBe(403);

    const writeDenied = await updateCostConfig(putReq(components()), ctx(brand.id));
    expect(writeDenied.status).toBe(403);
  });
});

describe("Cost Configuration API - update and atomic validation (Req 4.3, 4.5)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("updates all ten components as active for the selected Brand", async () => {
    const brand = await seedBrand("Cost Route Update");
    asSpv();

    const response = await updateCostConfig(
      putReq(components({ adminFee: 8, shippingFee: 12, operatingCost: 20 })),
      ctx(brand.id),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as CostComponents & { isActive: boolean };
    expect(body.isActive).toBe(true);
    expect(body.adminFee).toBe(8);
    expect(body.shippingFee).toBe(12);
    expect(body.operatingCost).toBe(20);
  });

  it("rejects out-of-range values without overwriting the previous config", async () => {
    const brand = await seedBrand("Cost Route Atomic");
    asSpv();

    const valid = await updateCostConfig(
      putReq(components({ adminFee: 8, marketingFee: 9 })),
      ctx(brand.id),
    );
    expect(valid.status).toBe(200);

    const invalid = await updateCostConfig(
      putReq(components({ adminFee: 50, marketingFee: 150 })),
      ctx(brand.id),
    );
    expect(invalid.status).toBe(422);
    const error = (await invalid.json()) as {
      errorType: string;
      fields: Record<string, string>;
    };
    expect(error.errorType).toBe("validation");
    expect(error.fields.marketingFee).toBeDefined();

    const reloaded = await getCostConfig(new Request("http://localhost"), ctx(brand.id));
    const body = (await reloaded.json()) as CostComponents;
    expect(body.adminFee).toBe(8);
    expect(body.marketingFee).toBe(9);
  });
});
