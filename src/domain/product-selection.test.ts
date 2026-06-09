import { describe, expect, it } from "vitest";

import { ProductStatus } from "./enums";
import { ProductSelection, ProductSelectionError } from "./product-selection";
import type { Product, ProductRef } from "./types";

let productSeq = 0;

/** Build a Product, defaulting to an Active product on brand "kalova". */
function product(overrides: Partial<Product> = {}): Product {
  productSeq += 1;
  const now = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: `prod-${productSeq}`,
    brandId: "kalova",
    productId: `P${productSeq}`,
    namaProduk: `Produk ${productSeq}`,
    kategori: "Umum",
    hpp: 50_000,
    hargaJual: 100_000,
    status: ProductStatus.Active,
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function ref(brandId: string, productId: string): ProductRef {
  return { brandId, productId };
}

describe("ProductSelection.selectableProducts restricts to Active same-Brand (Req 9.11, 9.13)", () => {
  it("includes only Active products owned by the promo Brand", () => {
    const active = product({ brandId: "kalova", status: ProductStatus.Active });
    const inactive = product({
      brandId: "kalova",
      status: ProductStatus.Inactive,
    });
    const archived = product({
      brandId: "kalova",
      status: ProductStatus.Archived,
    });
    const otherBrand = product({ brandId: "amk", status: ProductStatus.Active });

    const selectable = ProductSelection.selectableProducts(
      [active, inactive, archived, otherBrand],
      "kalova",
    );

    expect(selectable).toEqual([active]);
  });

  it("does not mutate the input list", () => {
    const products = [product(), product({ brandId: "amk" })];
    const snapshot = [...products];
    ProductSelection.selectableProducts(products, "kalova");
    expect(products).toEqual(snapshot);
  });
});

describe("ProductSelection.addProduct pulls fields and references by identity (Req 9.1, 9.10)", () => {
  it("references the product by (brandId, productId), never the name", () => {
    const p = product({ brandId: "kalova", productId: "12345" });
    const refs = ProductSelection.addProduct([], p, "kalova");
    expect(refs).toEqual([{ brandId: "kalova", productId: "12345" }]);
  });

  it("projects display fields straight from the Product_Master record", () => {
    const p = product({
      brandId: "kalova",
      productId: "12345",
      namaProduk: "Kaluna",
      hpp: 40_000,
      hargaJual: 90_000,
    });
    expect(ProductSelection.toSelectionItem(p)).toEqual({
      brandId: "kalova",
      productId: "12345",
      namaProduk: "Kaluna",
      hpp: 40_000,
      hargaJual: 90_000,
    });
  });
});

describe("ProductSelection.addProduct rejections (Req 9.3, 9.12, 9.13)", () => {
  it("rejects a product from a different Brand and keeps the list (Req 9.12)", () => {
    const current = [ref("kalova", "1")];
    const otherBrand = product({ brandId: "amk", productId: "2" });
    expect(() =>
      ProductSelection.addProduct(current, otherBrand, "kalova"),
    ).toThrow(ProductSelectionError);
    expect(current).toEqual([ref("kalova", "1")]);
  });

  it("rejects an Inactive or Archived product for a new promo (Req 9.13)", () => {
    const inactive = product({ status: ProductStatus.Inactive });
    const archived = product({ status: ProductStatus.Archived });
    expect(() => ProductSelection.addProduct([], inactive, "kalova")).toThrow(
      ProductSelectionError,
    );
    expect(() => ProductSelection.addProduct([], archived, "kalova")).toThrow(
      ProductSelectionError,
    );
  });

  it("rejects a duplicate and preserves the current list (Req 9.3)", () => {
    const p = product({ brandId: "kalova", productId: "12345" });
    const current = [ref("kalova", "12345")];
    expect(() => ProductSelection.addProduct(current, p, "kalova")).toThrow(
      ProductSelectionError,
    );
    expect(current).toEqual([ref("kalova", "12345")]);
  });
});

describe("ProductSelection.addProducts multi-select (Req 9.2, 9.7)", () => {
  it("adds many products in one action", () => {
    const a = product({ productId: "1" });
    const b = product({ productId: "2" });
    const c = product({ productId: "3" });
    const refs = ProductSelection.addProducts([], [a, b, c], "kalova");
    expect(refs).toEqual([
      ref("kalova", "1"),
      ref("kalova", "2"),
      ref("kalova", "3"),
    ]);
  });

  it("skips products already on the promo without failing (Req 9.3)", () => {
    const a = product({ productId: "1" });
    const b = product({ productId: "2" });
    const refs = ProductSelection.addProducts(
      [ref("kalova", "1")],
      [a, b],
      "kalova",
    );
    expect(refs).toEqual([ref("kalova", "1"), ref("kalova", "2")]);
  });

  it("rejects the whole multi-select when any product is from another Brand (Req 9.12)", () => {
    const a = product({ productId: "1" });
    const other = product({ brandId: "amk", productId: "2" });
    expect(() =>
      ProductSelection.addProducts([], [a, other], "kalova"),
    ).toThrow(ProductSelectionError);
  });
});

describe("ProductSelection.removeProduct (Req 9.4)", () => {
  it("removes a product reference by identity", () => {
    const current = [ref("kalova", "1"), ref("kalova", "2")];
    const result = ProductSelection.removeProduct(current, ref("kalova", "1"));
    expect(result).toEqual([ref("kalova", "2")]);
  });

  it("is a no-op when the reference is absent", () => {
    const current = [ref("kalova", "1")];
    const result = ProductSelection.removeProduct(current, ref("kalova", "9"));
    expect(result).toEqual([ref("kalova", "1")]);
  });
});

describe("ProductSelection.bulkAddByProductIds partitions without aborting (Req 9.6, 9.8, 9.9; Property 23)", () => {
  const catalogue: Product[] = [
    product({ brandId: "kalova", productId: "12345", status: ProductStatus.Active }),
    product({ brandId: "kalova", productId: "12346", status: ProductStatus.Active }),
    product({ brandId: "amk", productId: "55555", status: ProductStatus.Active }),
    product({ brandId: "kalova", productId: "77777", status: ProductStatus.Inactive }),
  ];

  it("adds same-Brand Active matches, skips other-Brand-only, reports unmatched", () => {
    const result = ProductSelection.bulkAddByProductIds(
      [],
      ["12345", "12346", "55555", "99999"],
      catalogue,
      "kalova",
    );

    expect(result.added).toEqual(["12345", "12346"]);
    expect(result.skippedOtherBrand).toEqual(["55555"]);
    expect(result.unmatched).toEqual(["99999"]);
    expect(result.skippedDuplicate).toEqual([]);
    expect(result.refs).toEqual([
      ref("kalova", "12345"),
      ref("kalova", "12346"),
    ]);
  });

  it("skips Product IDs already on the promo without error (Req 9.9)", () => {
    const result = ProductSelection.bulkAddByProductIds(
      [ref("kalova", "12345")],
      ["12345", "12346"],
      catalogue,
      "kalova",
    );
    expect(result.added).toEqual(["12346"]);
    expect(result.skippedDuplicate).toEqual(["12345"]);
  });

  it("treats an Inactive same-Brand-only match as unmatched for a new promo (Req 9.13)", () => {
    const result = ProductSelection.bulkAddByProductIds(
      [],
      ["77777"],
      catalogue,
      "kalova",
    );
    expect(result.unmatched).toEqual(["77777"]);
    expect(result.added).toEqual([]);
  });

  it("de-duplicates pasted IDs and ignores whitespace entries", () => {
    const result = ProductSelection.bulkAddByProductIds(
      [],
      ["12345", " 12345 ", "  ", "12346"],
      catalogue,
      "kalova",
    );
    expect(result.added).toEqual(["12345", "12346"]);
  });

  it("classifies every distinct ID into exactly one bucket (Property 23)", () => {
    const ids = ["12345", "12346", "55555", "99999", "77777"];
    const result = ProductSelection.bulkAddByProductIds(
      [],
      ids,
      catalogue,
      "kalova",
    );
    const total =
      result.added.length +
      result.skippedDuplicate.length +
      result.skippedOtherBrand.length +
      result.unmatched.length;
    expect(total).toBe(ids.length);
  });

  it("does not mutate the input refs", () => {
    const current = [ref("kalova", "12345")];
    const snapshot = [...current];
    ProductSelection.bulkAddByProductIds(current, ["12346"], catalogue, "kalova");
    expect(current).toEqual(snapshot);
  });
});

describe("ProductSelection.resolveSelectedItems preserves historical references (Req 9.1, 9.14)", () => {
  it("resolves Inactive/Archived references as valid historical items", () => {
    const inactive = product({
      brandId: "kalova",
      productId: "OLD-1",
      namaProduk: "Lama Inactive",
      status: ProductStatus.Inactive,
    });
    const archived = product({
      brandId: "kalova",
      productId: "OLD-2",
      namaProduk: "Lama Archived",
      status: ProductStatus.Archived,
    });
    const active = product({
      brandId: "kalova",
      productId: "NEW-1",
      namaProduk: "Baru Active",
      status: ProductStatus.Active,
    });

    const refs = [
      ref("kalova", "OLD-1"),
      ref("kalova", "OLD-2"),
      ref("kalova", "NEW-1"),
    ];
    const items = ProductSelection.resolveSelectedItems(
      refs,
      [inactive, archived, active],
    );

    expect(items.map((i) => i.productId)).toEqual(["OLD-1", "OLD-2", "NEW-1"]);
    expect(items.map((i) => i.namaProduk)).toEqual([
      "Lama Inactive",
      "Lama Archived",
      "Baru Active",
    ]);
  });

  it("omits a reference with no matching catalogue record without throwing", () => {
    const items = ProductSelection.resolveSelectedItems(
      [ref("kalova", "MISSING")],
      [],
    );
    expect(items).toEqual([]);
  });
});
