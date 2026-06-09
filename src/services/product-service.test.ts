import { beforeEach, describe, expect, it } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type Campaign,
  type PromoScenario,
} from "../domain";
import { InMemoryPersistence } from "../persistence";
import { ValidationError } from "./errors";
import { ProductService, type CreateProductInput } from "./product-service";

function makeBrand(id: string, brandId: string): Brand {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    brandName: brandId,
    displayName: brandId,
    status: BrandStatus.Active,
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

function productInput(
  overrides: Partial<CreateProductInput> = {},
): CreateProductInput {
  return {
    brandId: "brand-kalova",
    productId: "12345",
    namaProduk: "Kaluna",
    kategori: "Skincare",
    hpp: 50_000,
    hargaJual: 100_000,
    status: ProductStatus.Active,
    ...overrides,
  };
}

describe("ProductService.create", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
  });

  it("saves a valid product with audit fields and no warning (Req 3.1, 3.16, 23.2)", async () => {
    const { product, warning } = await service.create(productInput(), "user-1");

    expect(warning).toBeNull();
    expect(product.id).toBeTruthy();
    expect(product.brandId).toBe("brand-kalova");
    expect(product.productId).toBe("12345");
    expect(product.createdBy).toBe("user-1");
    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects a duplicate (brandId, productId) in the same Brand (Req 3.2)", async () => {
    await service.create(productInput(), "user-1");
    await expect(
      service.create(productInput({ namaProduk: "Different name" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows the same Product ID across different Brands but warns (Req 3.3)", async () => {
    await service.create(productInput({ brandId: "brand-kalova" }), "user-1");
    const { product, warning } = await service.create(
      productInput({ brandId: "brand-amk" }),
      "user-1",
    );

    expect(product.brandId).toBe("brand-amk");
    expect(warning).not.toBeNull();
    expect(warning).toContain("12345");
  });

  it("allows a duplicate Nama Produk with no constraint (Req 3.4, 3.5)", async () => {
    await service.create(productInput({ productId: "11111" }), "user-1");
    const { product } = await service.create(
      productInput({ productId: "22222", namaProduk: "Kaluna" }),
      "user-1",
    );
    expect(product.namaProduk).toBe("Kaluna");
  });

  it("rejects a missing or non-existent Brand (Req 3.7)", async () => {
    await expect(
      service.create(productInput({ brandId: "" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.create(productInput({ brandId: "brand-missing" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("restricts Status to Active/Inactive/Archived (Req 3.6)", async () => {
    await expect(
      service.create(
        productInput({ status: "Deleted" as unknown as ProductStatus }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    for (const status of [
      ProductStatus.Active,
      ProductStatus.Inactive,
      ProductStatus.Archived,
    ]) {
      const { product } = await service.create(
        productInput({ productId: `id-${status}`, status }),
        "user-1",
      );
      expect(product.status).toBe(status);
    }
  });
});

function makeCampaign(id: string, brandId: string): Campaign {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    nama: "Campaign",
    tanggalMulai: now,
    tanggalSelesai: now,
    status: CampaignStatus.Active,
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

function makePromoReferencing(
  id: string,
  brandId: string,
  campaignId: string,
  productId: string,
): PromoScenario {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    campaignId,
    namaPromo: "Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: now,
    tanggalSelesai: now,
    status: PromoStatus.Draft,
    executionStatus: null,
    rules: [],
    productRefs: [{ brandId, productId }],
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

describe("ProductService.update", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
  });

  it("persists changed fields and refreshes Updated At (Req 3.8, 3.16)", async () => {
    const { product } = await service.create(productInput(), "user-1");
    // Ensure a later timestamp is observable.
    await new Promise((r) => setTimeout(r, 2));

    const updated = await service.update(
      product.id,
      { namaProduk: "Kaluna Baru", hargaJual: 120_000, status: ProductStatus.Inactive },
      "user-2",
    );

    expect(updated.namaProduk).toBe("Kaluna Baru");
    expect(updated.hargaJual).toBe(120_000);
    expect(updated.status).toBe(ProductStatus.Inactive);
    // Unchanged fields are preserved.
    expect(updated.kategori).toBe("Skincare");
    expect(updated.hpp).toBe(50_000);
    expect(updated.productId).toBe("12345");
    // Audit fields: createdAt preserved, updatedAt advanced (Req 3.16).
    expect(updated.createdAt.getTime()).toBe(product.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      product.updatedAt.getTime(),
    );

    const persisted = await persistence.products.findById(product.id);
    expect(persisted?.namaProduk).toBe("Kaluna Baru");
  });

  it("rejects an invalid edit and preserves the previous stored data (Req 23.3, 23.4)", async () => {
    const { product } = await service.create(productInput(), "user-1");

    await expect(
      service.update(product.id, { hargaJual: -1 }, "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);

    const persisted = await persistence.products.findById(product.id);
    expect(persisted?.hargaJual).toBe(100_000);
    expect(persisted?.namaProduk).toBe("Kaluna");
  });

  it("rejects an update on a non-existent Product", async () => {
    await expect(
      service.update("missing", { namaProduk: "X" }, "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects renaming Product ID onto an existing one in the same Brand (Req 3.2)", async () => {
    await service.create(productInput({ productId: "11111" }), "user-1");
    const { product } = await service.create(
      productInput({ productId: "22222" }),
      "user-1",
    );

    await expect(
      service.update(product.id, { productId: "11111" }, "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ProductService.archive", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
  });

  it("marks the Product Archived without deleting its data (Req 3.11)", async () => {
    const { product } = await service.create(productInput(), "user-1");

    const archived = await service.archive(product.id, "user-1");

    expect(archived.status).toBe(ProductStatus.Archived);
    const persisted = await persistence.products.findById(product.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe(ProductStatus.Archived);
    // Other fields are untouched.
    expect(persisted?.namaProduk).toBe("Kaluna");
  });

  it("rejects archiving a non-existent Product", async () => {
    await expect(
      service.archive("missing", "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ProductService.delete", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.campaigns.insert(
      makeCampaign("campaign-1", "brand-kalova"),
    );
  });

  it("permanently deletes a Product that is not referenced by any promo (Req 3.9)", async () => {
    const { product } = await service.create(productInput(), "user-1");

    await service.delete(product.id, "user-1");

    const persisted = await persistence.products.findById(product.id);
    expect(persisted).toBeNull();
  });

  it("rejects permanent deletion of a referenced Product and directs to Archive (Req 3.10)", async () => {
    const { product } = await service.create(productInput(), "user-1");
    await persistence.promos.insert(
      makePromoReferencing(
        "promo-1",
        "brand-kalova",
        "campaign-1",
        product.productId,
      ),
    );

    await expect(
      service.delete(product.id, "user-1"),
    ).rejects.toMatchObject({
      errorType: "validation",
    });

    // The Product must remain so historical promo data stays valid (Req 3.10).
    const persisted = await persistence.products.findById(product.id);
    expect(persisted).not.toBeNull();

    // Archiving is the supported alternative.
    const archived = await service.archive(product.id, "user-1");
    expect(archived.status).toBe(ProductStatus.Archived);
  });

  it("rejects deleting a non-existent Product", async () => {
    await expect(
      service.delete("missing", "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ProductService.search", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));

    await service.create(
      productInput({
        brandId: "brand-kalova",
        productId: "12345",
        namaProduk: "Kaluna Serum",
      }),
      "user-1",
    );
    await service.create(
      productInput({
        brandId: "brand-kalova",
        productId: "67890",
        namaProduk: "Vitamin C Toner",
      }),
      "user-1",
    );
    await service.create(
      productInput({
        brandId: "brand-amk",
        productId: "12399",
        namaProduk: "AMK Moisturizer",
      }),
      "user-1",
    );
  });

  it("returns every product when no criteria are given (plain listing)", async () => {
    const results = await service.search();
    expect(results).toHaveLength(3);
  });

  it("matches a substring of the Nama Produk, case-insensitively (Req 3.14)", async () => {
    const results = await service.search({ keyword: "kaluna" });
    expect(results.map((p) => p.productId)).toEqual(["12345"]);
  });

  it("matches a substring of the Product ID (Req 3.14)", async () => {
    const results = await service.search({ keyword: "123" });
    // "12345" (Kalova) and "12399" (AMK) both contain "123".
    expect(results.map((p) => p.productId).sort()).toEqual(["12345", "12399"]);
  });

  it("returns products where EITHER Nama Produk OR Product ID contains the keyword (Req 3.14)", async () => {
    // "678" only matches the Product ID of the Vitamin C Toner.
    const byId = await service.search({ keyword: "678" });
    expect(byId.map((p) => p.productId)).toEqual(["67890"]);
    // "toner" only matches the Nama Produk of the same product.
    const byName = await service.search({ keyword: "toner" });
    expect(byName.map((p) => p.productId)).toEqual(["67890"]);
  });

  it("restricts results to a single Brand when a Brand filter is applied (Req 3.15)", async () => {
    const results = await service.search({ brandId: "brand-kalova" });
    expect(results).toHaveLength(2);
    expect(results.every((p) => p.brandId === "brand-kalova")).toBe(true);
  });

  it("combines keyword and Brand filters with AND semantics (Req 3.14, 3.15)", async () => {
    // "123" matches "12345" (Kalova) and "12399" (AMK); the Brand filter keeps Kalova only.
    const results = await service.search({
      keyword: "123",
      brandId: "brand-kalova",
    });
    expect(results.map((p) => p.productId)).toEqual(["12345"]);
  });

  it("ignores a whitespace-only keyword and treats blank Brand filter as no filter", async () => {
    const results = await service.search({ keyword: "   ", brandId: "  " });
    expect(results).toHaveLength(3);
  });

  it("returns an empty list when nothing matches the keyword", async () => {
    const results = await service.search({ keyword: "nonexistent" });
    expect(results).toEqual([]);
  });
});
