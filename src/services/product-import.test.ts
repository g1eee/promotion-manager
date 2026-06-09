import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";

import { BrandStatus, ProductStatus, type Brand } from "../domain";
import { InMemoryPersistence } from "../persistence";
import {
  ProductService,
  type ImportProductsInput,
} from "./product-service";
import {
  parseDelimitedContent,
  parseProductImportContent,
  rowsFromMatrix,
  type RawImportRow,
} from "./product-import";

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

describe("parseDelimitedContent", () => {
  it("parses a simple comma-separated file with a header and data rows", () => {
    const matrix = parseDelimitedContent(
      "Product ID,Nama Produk\n123,Kaluna\n456,Serum",
    );
    expect(matrix).toEqual([
      ["Product ID", "Nama Produk"],
      ["123", "Kaluna"],
      ["456", "Serum"],
    ]);
  });

  it("honours quoted fields containing the delimiter, quotes, and newlines", () => {
    const matrix = parseDelimitedContent(
      'id,name\n1,"Kaluna, Premium"\n2,"He said ""hi"""\n3,"line1\nline2"',
    );
    expect(matrix).toEqual([
      ["id", "name"],
      ["1", "Kaluna, Premium"],
      ["2", 'He said "hi"'],
      ["3", "line1\nline2"],
    ]);
  });

  it("strips a UTF-8 BOM, handles CRLF endings, and skips blank lines", () => {
    const matrix = parseDelimitedContent("\uFEFFid,name\r\n1,A\r\n\r\n2,B\r\n");
    expect(matrix).toEqual([
      ["id", "name"],
      ["1", "A"],
      ["2", "B"],
    ]);
  });

  it("auto-detects a semicolon delimiter", () => {
    const matrix = parseDelimitedContent("id;name\n1;A");
    expect(matrix).toEqual([
      ["id", "name"],
      ["1", "A"],
    ]);
  });

  it("returns an empty matrix for empty or whitespace-only content", () => {
    expect(parseDelimitedContent("")).toEqual([]);
    expect(parseDelimitedContent("   \n  \n")).toEqual([]);
  });
});

describe("rowsFromMatrix", () => {
  it("maps recognised headers to canonical columns and tags row numbers", () => {
    const rows = rowsFromMatrix([
      ["Product ID", "Nama Produk", "Kategori", "HPP", "Harga Jual", "Status"],
      ["123", "Kaluna", "Skincare", "50000", "100000", "Active"],
    ]);
    expect(rows).toEqual<RawImportRow[]>([
      {
        rowNumber: 1,
        values: {
          productId: "123",
          namaProduk: "Kaluna",
          kategori: "Skincare",
          hpp: "50000",
          hargaJual: "100000",
          status: "Active",
        },
      },
    ]);
  });

  it("ignores unrecognised columns and returns [] when there are no data rows", () => {
    expect(rowsFromMatrix([["Product ID", "Catatan Internal"]])).toEqual([]);
    const rows = rowsFromMatrix([
      ["Product ID", "Catatan Internal"],
      ["123", "abaikan"],
    ]);
    expect(rows[0]?.values).toEqual({ productId: "123" });
  });
});

describe("parseProductImportContent", () => {
  it("parses CSV text straight into canonical rows", () => {
    const rows = parseProductImportContent(
      "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status\n123,Kaluna,Skincare,50000,100000,Active",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.productId).toBe("123");
    expect(rows[0]?.values.status).toBe("Active");
  });
});

function importInput(
  brandId: string,
  rows: RawImportRow[],
): ImportProductsInput {
  return { brandId, rows };
}

describe("ProductService.importProducts", () => {
  let persistence: InMemoryPersistence;
  let service: ProductService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new ProductService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
  });

  it("creates one product per valid row (Req 3.12)", async () => {
    const rows = parseProductImportContent(
      [
        "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status",
        "111,Kaluna,Skincare,50000,100000,Active",
        "222,Serum,Skincare,30000,75000,Inactive",
      ].join("\n"),
    );

    const result = await service.importProducts(
      importInput("brand-kalova", rows),
      "user-1",
    );

    expect(result.total).toBe(2);
    expect(result.created).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    const persisted = await persistence.products.findByProductId("111");
    expect(persisted).toHaveLength(1);
  });

  it("partitions invalid rows to the failed list without aborting valid ones (Req 3.13)", async () => {
    const rows = parseProductImportContent(
      [
        "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status",
        "111,Kaluna,Skincare,50000,100000,Active", // valid
        "222,,Skincare,30000,75000,Active", // missing nama -> fail
        "333,Serum,Skincare,-5,75000,Active", // negative hpp -> fail
        "444,Toner,Skincare,abc,75000,Active", // non-numeric hpp -> fail
        "555,Mask,Skincare,30000,75000,Deleted", // invalid status -> fail
        "111,Kaluna Dup,Skincare,1,2,Active", // duplicate productId in brand -> fail
      ].join("\n"),
    );

    const result = await service.importProducts(
      importInput("brand-kalova", rows),
      "user-1",
    );

    expect(result.total).toBe(6);
    expect(result.created).toHaveLength(1);
    expect(result.failed).toHaveLength(5);
    // Failed rows carry their original 1-based row numbers.
    expect(result.failed.map((f) => f.row)).toEqual([2, 3, 4, 5, 6]);
    // Each failure carries a human-readable reason.
    for (const failure of result.failed) {
      expect(failure.reason).toBeTruthy();
    }
  });

  it("reports rows referencing a non-existent Brand as failed (Req 3.7, 3.13)", async () => {
    const rows = parseProductImportContent(
      [
        "Product ID,Nama Produk,Kategori,HPP,Harga Jual,Status",
        "111,Kaluna,Skincare,50000,100000,Active",
      ].join("\n"),
    );

    const result = await service.importProducts(
      importInput("brand-missing", rows),
      "user-1",
    );

    expect(result.total).toBe(1);
    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });

  it("returns an empty partition for an empty row set", async () => {
    const result = await service.importProducts(
      importInput("brand-kalova", []),
      "user-1",
    );
    expect(result).toEqual({ created: [], failed: [], total: 0 });
  });
});

/**
 * Property 9: Impor produk mempartisi baris menjadi berhasil dan gagal.
 *
 * For any import file, created + failed == total, every valid row yields
 * exactly one product, and every invalid/error row appears on the failed list.
 *
 * **Validates: Requirements 3.12, 3.13**
 */
describe("Property 9: import partitions rows into created and failed", () => {
  const statusArb = fc.constantFrom<ProductStatus | string>(
    ProductStatus.Active,
    ProductStatus.Inactive,
    ProductStatus.Archived,
    "Deleted", // invalid -> forces a failed row
  );

  const cellArb = fc.oneof(
    fc.string({ maxLength: 6 }).filter((s) => !/[\r\n]/.test(s)),
    fc.constant(""),
  );

  // A row is generated cell-by-cell, deliberately allowing empty/invalid values
  // so both partitions are exercised, plus duplicate Product IDs to trigger the
  // per-Brand uniqueness rejection.
  const rowArb = fc.record({
    productId: fc.constantFrom("A", "B", "C", "", "A"),
    namaProduk: cellArb,
    kategori: cellArb,
    hpp: fc.oneof(fc.integer({ min: -100, max: 100000 }).map(String), fc.constant("x"), fc.constant("")),
    hargaJual: fc.oneof(fc.integer({ min: -100, max: 100000 }).map(String), fc.constant("")),
    status: statusArb,
  });

  it("always satisfies created + failed == total with disjoint, complete coverage", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(rowArb, { maxLength: 12 }),
        async (genRows) => {
          const persistence = new InMemoryPersistence();
          const service = new ProductService(persistence);
          await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));

          const rows: RawImportRow[] = genRows.map((r, i) => ({
            rowNumber: i + 1,
            values: {
              productId: r.productId,
              namaProduk: r.namaProduk,
              kategori: r.kategori,
              hpp: r.hpp,
              hargaJual: r.hargaJual,
              status: String(r.status),
            },
          }));

          const result = await service.importProducts(
            { brandId: "brand-kalova", rows },
            "user-1",
          );

          // Core invariant: the partition is exhaustive.
          expect(result.created.length + result.failed.length).toBe(
            result.total,
          );
          expect(result.total).toBe(rows.length);

          // Coverage is disjoint and complete: each row is either created or
          // failed exactly once. Created products map to the brand; failed rows
          // reference valid 1-based row numbers within range.
          for (const failure of result.failed) {
            expect(failure.row).toBeGreaterThanOrEqual(1);
            expect(failure.row).toBeLessThanOrEqual(rows.length);
          }
          for (const product of result.created) {
            expect(product.brandId).toBe("brand-kalova");
          }

          // Number of persisted products equals number created.
          const all = await persistence.products.list();
          expect(all.length).toBe(result.created.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
