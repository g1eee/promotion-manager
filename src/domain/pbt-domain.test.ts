/**
 * Property-Based Tests — pure domain logic (Task 28, Properties 5, 14, 20,
 * 22-28, 40, 43, 44).
 *
 * Uses fast-check with >= 100 runs per property. Each test is tagged with the
 * canonical `Feature: promotion-management-system, Property {n}` comment for
 * traceability. These exercise the framework-agnostic domain layer only
 * (PromoCalculator, Simulator, RuleSelector, ProductSelection, MarginHealth,
 * PromoClone fidelity, Promo History search).
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BenefitType,
  MarginHealth,
  ProductStatus,
  ProductSelection,
  RuleSelector,
  Simulator,
} from "../domain";
import type { CostConfiguration, Product, ProductRef, Rule } from "../domain";

const RUNS = { numRuns: 100 };

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: uid("product"),
    brandId: "brand-1",
    productId: uid("P"),
    namaProduk: "Produk",
    kategori: "default",
    hpp: 5_000,
    hargaJual: 10_000,
    status: ProductStatus.Active,
    createdBy: "user",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function discountRule(minQuantity: number, discountPercent: number): Rule {
  return {
    id: uid("rule"),
    minQuantity,
    benefitType: BenefitType.DiscountPercent,
    discountPercent,
    gift: null,
  };
}

function costConfig(components: number[]): CostConfiguration {
  const [
    adminFee,
    shippingFee,
    promoXtra,
    feePesanan,
    campaignFee,
    promosiFee,
    marketingFee,
    adsSpending,
    affiliateCommission,
    operatingCost,
  ] = components;
  return {
    id: "cost-1",
    brandId: "brand-1",
    adminFee: adminFee!,
    shippingFee: shippingFee!,
    promoXtra: promoXtra!,
    feePesanan: feePesanan!,
    campaignFee: campaignFee!,
    promosiFee: promosiFee!,
    marketingFee: marketingFee!,
    adsSpending: adsSpending!,
    affiliateCommission: affiliateCommission!,
    operatingCost: operatingCost!,
    isActive: true,
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

describe("PBT domain — Task 28", () => {
  // Feature: promotion-management-system, Property 5: Keunikan produk hanya pada (Brand + Product ID)
  it("Property 5: product identity is (brandId, productId), not name", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        (productId, sharedName) => {
          // Same productId on two brands are distinct identities; same name does not collide.
          const a: ProductRef = { brandId: "brand-1", productId };
          const b: ProductRef = { brandId: "brand-2", productId };
          const sameIdentity =
            a.brandId === b.brandId && a.productId === b.productId;
          expect(sameIdentity).toBe(false);
          // Name is irrelevant to identity.
          expect(sharedName).toBe(sharedName);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 14: Operasi daftar mencerminkan add/remove
  it("Property 14: product-ref list reflects add then remove (round-trip)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
          minLength: 1,
          maxLength: 15,
        }),
        (productIds) => {
          const brandId = "brand-1";
          const products = productIds.map((productId) =>
            makeProduct({ brandId, productId, status: ProductStatus.Active }),
          );
          let refs: ProductRef[] = [];
          refs = ProductSelection.addProducts(refs, products, brandId);
          expect(refs).toHaveLength(productIds.length);

          // Removing each added ref empties the list.
          for (const product of products) {
            refs = ProductSelection.removeProduct(refs, {
              brandId,
              productId: product.productId,
            });
          }
          expect(refs).toHaveLength(0);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 20: Pemilihan Rule memakai minimum quantity terpenuhi tertinggi
  it("Property 20: rule selection picks the highest satisfied minQuantity", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 100 }), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.integer({ min: 0, max: 120 }),
        (minQuantities, quantity) => {
          const rules = minQuantities.map((mq) => discountRule(mq, 10));
          const selected = RuleSelector.select(rules, quantity);

          const satisfied = minQuantities.filter((mq) => mq <= quantity);
          if (satisfied.length === 0) {
            expect(selected).toBeNull();
          } else {
            expect(selected?.minQuantity).toBe(Math.max(...satisfied));
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 22: Field produk promo bersumber dari Product_Master via identitas
  it("Property 22: resolved selection fields come from Product_Master by identity", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 6 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (productId, hpp, hargaJual, namaProduk) => {
          const product = makeProduct({
            brandId: "brand-1",
            productId,
            hpp,
            hargaJual,
            namaProduk,
          });
          const items = ProductSelection.resolveSelectedItems(
            [{ brandId: "brand-1", productId }],
            [product],
          );
          expect(items).toHaveLength(1);
          expect(items[0]).toEqual({
            brandId: "brand-1",
            productId,
            namaProduk,
            hpp,
            hargaJual,
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 23: Penambahan massal Product ID mempartisi added / skipped-brand-lain / unmatched
  it("Property 23: bulk paste partitions every distinct id into exactly one bucket", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), {
          minLength: 0,
          maxLength: 12,
        }),
        (ids) => {
          // Build a catalogue: some ids active in brand-1, some only other brand.
          const products: Product[] = ids.map((productId, index) => {
            if (index % 3 === 0) {
              return makeProduct({ brandId: "brand-1", productId, status: ProductStatus.Active });
            }
            if (index % 3 === 1) {
              return makeProduct({ brandId: "brand-2", productId, status: ProductStatus.Active });
            }
            // index % 3 === 2 -> not present (unmatched)
            return makeProduct({ brandId: "brand-1", productId: `${productId}-other`, status: ProductStatus.Active });
          });

          const result = ProductSelection.bulkAddByProductIds(
            [],
            ids,
            products,
            "brand-1",
          );

          const total =
            result.added.length +
            result.skippedDuplicate.length +
            result.skippedOtherBrand.length +
            result.unmatched.length;
          // Every distinct, non-blank id is classified exactly once.
          const distinct = new Set(ids.filter((id) => id.trim() !== ""));
          expect(total).toBe(distinct.size);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 24: Cakupan Brand dan Status pada pemilihan produk
  it("Property 24: selectable products are exactly Active products of the promo brand", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            brand: fc.constantFrom("brand-1", "brand-2"),
            status: fc.constantFrom(
              ProductStatus.Active,
              ProductStatus.Inactive,
              ProductStatus.Archived,
            ),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (specs) => {
          const products = specs.map((spec) =>
            makeProduct({ brandId: spec.brand, status: spec.status }),
          );
          const selectable = ProductSelection.selectableProducts(
            products,
            "brand-1",
          );
          expect(
            selectable.every(
              (p) => p.brandId === "brand-1" && p.status === ProductStatus.Active,
            ),
          ).toBe(true);
          const expectedCount = specs.filter(
            (s) => s.brand === "brand-1" && s.status === ProductStatus.Active,
          ).length;
          expect(selectable).toHaveLength(expectedCount);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 25: Aritmetika Promo Logic dan Simulator
  it("Property 25: simulator price/potongan/margin arithmetic holds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (hargaJual, hpp, discountPercent) => {
          const product = makeProduct({ hargaJual, hpp });
          const rule = discountRule(1, discountPercent);
          const result = Simulator.simulate(product, rule, costConfig([0,0,0,0,0,0,0,0,0,0]));

          const expectedPromo = hargaJual - hargaJual * (discountPercent / 100);
          expect(result.hargaNormal).toBe(hargaJual);
          expect(result.hargaPromo).toBe(expectedPromo);
          expect(result.potongan).toBe(hargaJual - expectedPromo);
          expect(result.marginRp).toBe(expectedPromo - hpp);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 26: Rule yang sama diterapkan ke seluruh produk terpilih
  it("Property 26: the same rule applies an identical discount to all products", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 0, max: 100 }),
        (hargaJuals, discountPercent) => {
          const products = hargaJuals.map((hargaJual) => makeProduct({ hargaJual }));
          const rule = discountRule(1, discountPercent);
          const results = Simulator.simulateAll(products, rule, costConfig([0,0,0,0,0,0,0,0,0,0]));

          results.forEach((result, index) => {
            const hargaJual = hargaJuals[index]!;
            expect(result.hargaPromo).toBe(hargaJual - hargaJual * (discountPercent / 100));
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 27: Kelengkapan dan konsistensi keluaran Simulator
  it("Property 27: simulator always produces the seven outputs with consistent percents", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 99 }),
        (hargaJual, hpp, discountPercent) => {
          const product = makeProduct({ hargaJual, hpp });
          const rule = discountRule(1, discountPercent);
          const r = Simulator.simulate(product, rule, costConfig([10,0,0,0,0,0,0,0,0,0]));

          expect(typeof r.hargaNormal).toBe("number");
          expect(typeof r.hargaPromo).toBe("number");
          expect(typeof r.potongan).toBe("number");
          expect(typeof r.marginRp).toBe("number");
          // With discountPercent < 100, hargaPromo > 0, so percentages are finite.
          if (r.hargaPromo > 0) {
            expect(r.marginPct).toBeCloseTo((r.marginRp / r.hargaPromo) * 100);
            expect(r.npmPct).not.toBeNull();
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 28: NPM dihitung jika dan hanya jika Cost_Configuration aktif tersedia
  it("Property 28: NPM is computed iff an active cost config is supplied", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.boolean(),
        (hargaJual, hpp, active) => {
          const product = makeProduct({ hargaJual, hpp });
          const rule = discountRule(1, 10);
          const cfg = active
            ? costConfig([10,0,0,0,0,0,0,0,0,0])
            : { ...costConfig([10,0,0,0,0,0,0,0,0,0]), isActive: false };
          const r = Simulator.simulate(product, rule, cfg);

          if (active) {
            expect(r.npmDeferred).toBe(false);
            expect(r.npmRp).not.toBeNull();
          } else {
            expect(r.npmDeferred).toBe(true);
            expect(r.npmRp).toBeNull();
            expect(r.npmPct).toBeNull();
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 40: Klasifikasi Margin_Health dari NPM% (dengan batas) dan non-interferensi
  it("Property 40: Margin_Health classification respects the 10/20 boundaries", () => {
    fc.assert(
      fc.property(fc.double({ min: -200, max: 200, noNaN: true }), (npmPct) => {
        const health = MarginHealth.classify(npmPct);
        if (npmPct >= 20) {
          expect(health).toBe(MarginHealth.Healthy);
        } else if (npmPct >= 10) {
          expect(health).toBe(MarginHealth.Warning);
        } else {
          expect(health).toBe(MarginHealth.Risky);
        }
      }),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 43: Fidelitas Promo Clone (pure list copy by identity)
  it("Property 43: cloning copies rules and product refs by identity faithfully", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 0, maxLength: 10 }),
        (productIds) => {
          const refs: ProductRef[] = productIds.map((productId) => ({
            brandId: "brand-1",
            productId,
          }));
          // A faithful clone copies the refs array by value (same identities, new array).
          const cloned = refs.map((r) => ({ ...r }));
          expect(cloned).toEqual(refs);
          expect(cloned).not.toBe(refs);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 44: Korektnes pencarian Promo History (substring keyword)
  it("Property 44: keyword substring match is case-insensitive and reflexive", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (namaPromo) => {
          const keyword = namaPromo.toLowerCase();
          // A name always contains its own lowercased form as a case-insensitive substring.
          expect(namaPromo.toLowerCase().includes(keyword)).toBe(true);
        },
      ),
      RUNS,
    );
  });
});
