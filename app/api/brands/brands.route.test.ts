/**
 * Brand API Route Handler tests (Task 5.2).
 *
 * Exercise RBAC enforcement (Req 1.2 SPV allowed, Req 1.6 Admin denied) and
 * domain-error → HTTP mapping for create/update/archive/delete (Req 19.1, 19.3,
 * 19.5/19.7, 19.6) against the real in-memory container.
 *
 * `@/auth` is mocked so the session reader (`auth`) is controllable while the
 * pure AccessController logic remains real (the single source of truth for
 * write enforcement).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role, ProductStatus, BrandStatus } from "@domain/enums";
import type { Product } from "@domain/types";

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

// Imported after the mock is registered so they bind to the mocked `@/auth`.
import { POST as createBrand } from "./route";
import { PATCH as updateBrand, DELETE as deleteBrand } from "./[id]/route";
import { POST as archiveBrand } from "./[id]/archive/route";
import { getContainer } from "@/api/container";

function asSpv(): void {
  mockAuth.mockResolvedValue({ user: { id: "user-spv", role: Role.SPV_Marketing } });
}
function asAdmin(): void {
  mockAuth.mockResolvedValue({ user: { id: "user-admin", role: Role.Admin_Marketplace } });
}
function asAnonymous(): void {
  mockAuth.mockResolvedValue(null);
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/brands", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/brands/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

let unique = 0;
function freshBrandId(prefix: string): string {
  unique += 1;
  return `${prefix}-${Date.now()}-${unique}`;
}

/** Create a Brand via the API and return its surrogate id. */
async function createBrandReturningId(brandId: string): Promise<string> {
  asSpv();
  const res = await createBrand(
    postReq({ brandId, brandName: brandId, displayName: brandId }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

describe("Brand API — RBAC (Req 1.2, 1.6)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("allows SPV_Marketing to create a Brand and stamps createdBy (Req 1.2, 19.1, 23.2)", async () => {
    asSpv();
    const brandId = freshBrandId("RBAC-SPV");
    const res = await createBrand(
      postReq({ brandId, brandName: "Spv Brand", displayName: "Spv" }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { brandId: string; createdBy: string; status: string };
    expect(body.brandId).toBe(brandId);
    expect(body.createdBy).toBe("user-spv");
    expect(body.status).toBe(BrandStatus.Active);
  });

  it("denies Admin_Marketplace create with an access-denied message (Req 1.6)", async () => {
    asAdmin();
    const res = await createBrand(
      postReq({ brandId: freshBrandId("RBAC-ADM"), brandName: "x", displayName: "x" }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { errorType: string };
    expect(body.errorType).toBe("access_denied");
  });

  it("denies Admin_Marketplace update and delete (Req 1.6)", async () => {
    const id = await createBrandReturningId(freshBrandId("RBAC-ADM-MUT"));
    asAdmin();
    const upd = await updateBrand(patchReq({ brandName: "y" }), ctx(id));
    expect(upd.status).toBe(403);
    const del = await deleteBrand(new Request("http://localhost"), ctx(id));
    expect(del.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    asAnonymous();
    const res = await createBrand(
      postReq({ brandId: freshBrandId("ANON"), brandName: "x", displayName: "x" }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { errorType: string };
    expect(body.errorType).toBe("unauthenticated");
  });
});

describe("Brand API — create error mapping (Req 19.1)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("maps missing required fields to 422 validation", async () => {
    asSpv();
    const res = await createBrand(postReq({}));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errorType: string; fields: Record<string, string> };
    expect(body.errorType).toBe("validation");
    expect(body.fields.brandId).toBeDefined();
  });

  it("maps a malformed JSON body to 422 validation", async () => {
    asSpv();
    const bad = new Request("http://localhost/api/brands", {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await createBrand(bad);
    expect(res.status).toBe(422);
  });

  it("maps a duplicate Brand ID to 422 validation (Req 19.2)", async () => {
    const brandId = freshBrandId("DUP");
    await createBrandReturningId(brandId);
    asSpv();
    const res = await createBrand(postReq({ brandId, brandName: "again", displayName: "again" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errorType: string; fields: Record<string, string> };
    expect(body.errorType).toBe("validation");
    expect(body.fields.brandId).toBeDefined();
  });
});

describe("Brand API — update/archive/delete (Req 19.3, 19.5/19.7, 19.6)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("updates a Brand when validation passes (Req 19.3)", async () => {
    const id = await createBrandReturningId(freshBrandId("UPD"));
    asSpv();
    const res = await updateBrand(patchReq({ brandName: "Renamed" }), ctx(id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { brandName: string };
    expect(body.brandName).toBe("Renamed");
  });

  it("maps update of a non-existent Brand to 404", async () => {
    asSpv();
    const res = await updateBrand(patchReq({ brandName: "x" }), ctx("brand-does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("maps invalid update fields to 422 validation (Req 19.4)", async () => {
    const id = await createBrandReturningId(freshBrandId("UPD-INVALID"));
    asSpv();
    const res = await updateBrand(patchReq({ brandName: "   " }), ctx(id));
    expect(res.status).toBe(422);
  });

  it("archives a Brand without deleting it (Req 19.7)", async () => {
    const id = await createBrandReturningId(freshBrandId("ARC"));
    asSpv();
    const res = await archiveBrand(new Request("http://localhost"), ctx(id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe(BrandStatus.Archived);
  });

  it("deletes a Brand with no related data (Req 19.5)", async () => {
    const id = await createBrandReturningId(freshBrandId("DEL"));
    asSpv();
    const res = await deleteBrand(new Request("http://localhost"), ctx(id));
    expect(res.status).toBe(200);
  });

  it("maps delete of a Brand with related data to 409 constraint (Req 19.6)", async () => {
    const id = await createBrandReturningId(freshBrandId("DEL-REF"));
    const { persistence } = await getContainer();
    const now = new Date();
    const product: Product = {
      id: `prod-${id}`,
      brandId: id,
      productId: "P-1",
      namaProduk: "Linked Product",
      kategori: "Misc",
      hpp: 1000,
      hargaJual: 2000,
      status: ProductStatus.Active,
      createdBy: "user-spv",
      createdAt: now,
      updatedAt: now,
    };
    await persistence.products.insert(product);

    asSpv();
    const res = await deleteBrand(new Request("http://localhost"), ctx(id));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { errorType: string; message: string };
    expect(body.errorType).toBe("constraint");
    expect(body.message).toContain("data terkait");
  });
});
