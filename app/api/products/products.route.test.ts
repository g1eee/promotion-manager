/**
 * Product Master API Route Handler tests (Task 6.8).
 *
 * Covers RBAC, CRUD/search, import template, row-level import feedback, and
 * archive/delete mapping against the real in-memory container.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrandStatus, ProductStatus, Role } from "@domain/enums";
import type { Brand } from "@domain/types";

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
import { GET as listProducts, POST as createProduct } from "./route";
import {
  DELETE as deleteProduct,
  PATCH as updateProduct,
} from "./[id]/route";
import { POST as archiveProduct } from "./[id]/archive/route";
import { POST as importProducts } from "./import/route";
import { GET as downloadTemplate } from "./import/template/route";

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

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function productPostReq(body: unknown): Request {
  return jsonRequest("http://localhost/api/products", "POST", body);
}

function productPatchReq(body: unknown): Request {
  return jsonRequest("http://localhost/api/products/x", "PATCH", body);
}

function importReq(body: unknown): Request {
  return jsonRequest("http://localhost/api/products/import", "POST", body);
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

let unique = 0;
function fresh(prefix: string): string {
  unique += 1;
  return `${prefix}-${Date.now()}-${unique}`;
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

async function createProductReturningId(
  brandId: string,
  productId = fresh("P"),
): Promise<string> {
  asSpv();
  const response = await createProduct(
    productPostReq({
      brandId,
      productId,
      namaProduk: `Produk ${productId}`,
      kategori: "Skincare",
      hpp: 10000,
      hargaJual: 25000,
      status: ProductStatus.Active,
    }),
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as { product: { id: string } };
  return body.product.id;
}

describe("Product API - RBAC and create/search (Req 1.2, 1.6, 3.1, 3.14, 3.15)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("allows SPV_Marketing to create a Product and stamps createdBy", async () => {
    const brand = await seedBrand("Route Product Create");
    asSpv();

    const response = await createProduct(
      productPostReq({
        brandId: brand.id,
        productId: fresh("SKU"),
        namaProduk: "Serum Kalova",
        kategori: "Serum",
        hpp: 12000,
        hargaJual: 30000,
        status: ProductStatus.Active,
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      product: { brandId: string; createdBy: string };
      warning: string | null;
    };
    expect(body.product.brandId).toBe(brand.id);
    expect(body.product.createdBy).toBe("user-spv");
    expect(body.warning).toBeNull();
  });

  it("denies Admin_Marketplace from Product Master create and update", async () => {
    const brand = await seedBrand("Route Product RBAC");
    const id = await createProductReturningId(brand.id);

    asAdmin();
    const createDenied = await createProduct(
      productPostReq({
        brandId: brand.id,
        productId: fresh("DENIED"),
        namaProduk: "Denied",
        kategori: "Test",
        hpp: 1,
        hargaJual: 2,
        status: ProductStatus.Active,
      }),
    );
    expect(createDenied.status).toBe(403);

    const updateDenied = await updateProduct(
      productPatchReq({ namaProduk: "Nope" }),
      ctx(id),
    );
    expect(updateDenied.status).toBe(403);
  });

  it("lists by Brand and keyword substring", async () => {
    const kalova = await seedBrand("Route Product Kalova");
    const amk = await seedBrand("Route Product AMK");
    await createProductReturningId(kalova.id, fresh("MATCH"));
    await createProductReturningId(amk.id, fresh("OTHER"));

    asSpv();
    const url = new URL("http://localhost/api/products");
    url.searchParams.set("brandId", kalova.id);
    url.searchParams.set("keyword", "Produk MATCH");

    const response = await listProducts(new Request(url));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { brandId: string; namaProduk: string }[];
    expect(body).toHaveLength(1);
    expect(body[0]!.brandId).toBe(kalova.id);
    expect(body[0]!.namaProduk).toContain("MATCH");
  });
});

describe("Product API - import/template/archive/delete (Req 3.10, 3.11, 3.12, 3.13)", () => {
  beforeEach(() => mockAuth.mockReset());

  it("downloads the CSV import template with canonical headers", async () => {
    asSpv();
    const response = await downloadTemplate();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toContain(
      "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status",
    );
  });

  it("imports valid rows and returns summary plus per-row validation feedback", async () => {
    const brand = await seedBrand("Route Product Import");
    const productId = fresh("IMPORT");
    asSpv();

    const content = [
      "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status",
      `${productId},Serum Import,Serum,10000,25000,Active`,
      ",Missing ID,Serum,10000,25000,Active",
    ].join("\n");

    const response = await importProducts(importReq({ brandId: brand.id, content }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      created: unknown[];
      failed: { row: number; fields?: Record<string, string> }[];
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.created).toHaveLength(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]!.row).toBe(2);
    expect(body.failed[0]!.fields?.productId).toBeDefined();
  });

  it("archives a Product without deleting it", async () => {
    const brand = await seedBrand("Route Product Archive");
    const id = await createProductReturningId(brand.id);

    asSpv();
    const response = await archiveProduct(new Request("http://localhost"), ctx(id));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: ProductStatus };
    expect(body.status).toBe(ProductStatus.Archived);
  });

  it("deletes an unreferenced Product", async () => {
    const brand = await seedBrand("Route Product Delete");
    const id = await createProductReturningId(brand.id);

    asSpv();
    const response = await deleteProduct(new Request("http://localhost"), ctx(id));
    expect(response.status).toBe(200);
  });
});
