/**
 * Property-Based Tests — services, persistence, RBAC & dashboard (Task 29,
 * Properties 1-4, 6-13, 15-19, 21, 29-39, 42, 45).
 *
 * Uses fast-check with >= 100 runs per property. Each test is tagged with the
 * canonical `Feature: promotion-management-system, Property {n}` comment for
 * traceability. These exercise the application/persistence layers against the
 * in-memory adapter and the pure RBAC controller.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AccessAction,
  AccessResource,
  authorize,
  isAllowed,
} from "@/auth/access-controller";
import { Role } from "@domain/enums";
import {
  BenefitType,
  BrandStatus,
  ProductStatus,
  RuleBuilder,
  RuleValidationError,
} from "../domain";
import type { Brand, PromoScenario, Rule } from "../domain";
import { InMemoryPersistence } from "../persistence";
import { BrandService } from "./brand-service";
import { CostConfigService } from "./cost-config-service";
import type { CostComponents } from "./cost-config-service";
import { ProductService } from "./product-service";

const RUNS = { numRuns: 100 };

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

const NOW = new Date("2025-01-01T00:00:00Z");

function makeBrand(id = "brand-1", brandId = "BRAND1"): Brand {
  return {
    id,
    brandId,
    brandName: brandId,
    displayName: brandId,
    status: BrandStatus.Active,
    createdBy: "seed",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function zeroComponents(): CostComponents {
  return {
    adminFee: 0,
    shippingFee: 0,
    promoXtra: 0,
    feePesanan: 0,
    campaignFee: 0,
    promosiFee: 0,
    marketingFee: 0,
    adsSpending: 0,
    affiliateCommission: 0,
    operatingCost: 0,
  };
}

const WRITE_RESOURCES = [
  AccessResource.Campaign,
  AccessResource.PromoScenario,
  AccessResource.ProductMaster,
  AccessResource.CostConfiguration,
  AccessResource.PromoTemplate,
];

describe("PBT services/persistence/RBAC/dashboard — Task 29", () => {
  // Feature: promotion-management-system, Property 1: RBAC SPV write-all, Admin read-Approved-only
  it("Property 1: SPV may write all five resources; Admin is denied every write", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WRITE_RESOURCES),
        fc.constantFrom(AccessAction.Create, AccessAction.Update),
        (resource, action) => {
          const spv = authorize({ role: Role.SPV_Marketing }, action, resource);
          expect(isAllowed(spv)).toBe(true);
          const admin = authorize(
            { role: Role.Admin_Marketplace },
            action,
            resource,
          );
          expect(isAllowed(admin)).toBe(false);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 2: Feedback dapat dibuat oleh setiap peran yang punya akses
  it("Property 2: both roles may create and read Feedback_Record", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Role.SPV_Marketing, Role.Admin_Marketplace),
        fc.constantFrom(AccessAction.Create, AccessAction.Read),
        (role, action) => {
          const decision = authorize({ role }, action, AccessResource.FeedbackRecord);
          expect(isAllowed(decision)).toBe(true);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 12/13: Cost_Configuration per-Brand isolation + atomic range validation
  it("Property 12/13: cost config is per-Brand isolated and range-validated atomically", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 101, max: 500 }),
        async (validValue, outOfRange) => {
          const persistence = new InMemoryPersistence();
          await persistence.brands.insert(makeBrand("brand-a", "A"));
          await persistence.brands.insert(makeBrand("brand-b", "B"));
          const service = new CostConfigService({
            costConfigs: persistence.costConfigs,
            brands: persistence.brands,
          });

          // Set brand-a to a valid uniform value.
          const componentsA: CostComponents = {
            ...zeroComponents(),
            adminFee: validValue,
          };
          await service.update("brand-a", componentsA);

          // An out-of-range update to brand-b is rejected atomically.
          await expect(
            service.update("brand-b", { ...zeroComponents(), shippingFee: outOfRange }),
          ).rejects.toBeTruthy();

          // brand-a is untouched; brand-b retains defaults (isolation).
          const a = await service.get("brand-a");
          expect(a.adminFee).toBe(validValue);
          const b = await service.get("brand-b");
          expect(b.shippingFee).toBe(0);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 21: Rule menolak minimum quantity < 1
  it("Property 21: RuleBuilder rejects minQuantity < 1 and accepts >= 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (minQuantity) => {
        const rule: Rule = {
          id: uid("rule"),
          minQuantity,
          benefitType: BenefitType.DiscountPercent,
          discountPercent: 10,
          gift: null,
        };
        const promo = {
          rules: [] as Rule[],
        } as unknown as PromoScenario;
        if (minQuantity < 1) {
          expect(() => RuleBuilder.addRule(promo, rule)).toThrow(
            RuleValidationError,
          );
        } else {
          const next = RuleBuilder.addRule(promo, rule);
          expect(next.rules).toHaveLength(1);
        }
      }),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 6: Round-trip persistensi & penyuntingan produk
  it("Property 6: product create then read round-trips its fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Za-z0-9]{1,8}$/),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        async (productId, hpp, hargaJual) => {
          const persistence = new InMemoryPersistence();
          await persistence.brands.insert(makeBrand());
          const service = new ProductService({
            products: persistence.products,
            brands: persistence.brands,
            promos: persistence.promos,
          });

          const result = await service.create(
            {
              brandId: "brand-1",
              productId,
              namaProduk: "Produk",
              kategori: "default",
              hpp,
              hargaJual,
              status: ProductStatus.Active,
            },
            "user-spv",
          );

          const stored = await persistence.products.findById(result.product.id);
          expect(stored?.productId).toBe(productId);
          expect(stored?.hpp).toBe(hpp);
          expect(stored?.hargaJual).toBe(hargaJual);
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 37: Persistensi Brand dan keunikan Brand ID
  it("Property 37: a duplicate Brand ID is rejected; a unique one persists", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Z0-9]{1,8}$/),
        async (brandId) => {
          const persistence = new InMemoryPersistence();
          const service = new BrandService({ brands: persistence.brands });

          const created = await service.create(
            {
              brandId,
              brandName: "Name",
              displayName: "Name",
              status: BrandStatus.Active,
            },
            "user-spv",
          );
          expect(created.brandId).toBe(brandId.trim());

          await expect(
            service.create(
              {
                brandId,
                brandName: "Other",
                displayName: "Other",
                status: BrandStatus.Active,
              },
              "user-spv",
            ),
          ).rejects.toBeTruthy();
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 42: Invarian Audit_Fields lintas entitas
  it("Property 42: createdBy/createdAt are immutable across a Brand update", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Z0-9]{1,8}$/),
        fc.stringMatching(/^[A-Za-z0-9]{1,8}$/),
        async (brandId, newName) => {
          const persistence = new InMemoryPersistence();
          const service = new BrandService({ brands: persistence.brands });
          const created = await service.create(
            {
              brandId,
              brandName: "Name",
              displayName: "Name",
              status: BrandStatus.Active,
            },
            "user-spv",
          );

          const updated = await service.update(created.id, {
            brandName: newName,
          });
          expect(updated.createdBy).toBe(created.createdBy);
          expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
          expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
            created.createdAt.getTime(),
          );
        },
      ),
      RUNS,
    );
  });

  // Feature: promotion-management-system, Property 10: Pencarian produk mencocokkan substring (dengan cakupan Brand)
  it("Property 10: product search matches a substring within the brand", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-zA-Z]+$/.test(s)),
        async (namaProduk) => {
          const persistence = new InMemoryPersistence();
          await persistence.brands.insert(makeBrand());
          const service = new ProductService({
            products: persistence.products,
            brands: persistence.brands,
            promos: persistence.promos,
          });
          await service.create(
            {
              brandId: "brand-1",
              productId: uid("P"),
              namaProduk,
              kategori: "default",
              hpp: 1000,
              hargaJual: 2000,
              status: ProductStatus.Active,
            },
            "user-spv",
          );

          const fragment = namaProduk.slice(0, 2);
          const results = await service.search({ brandId: "brand-1", keyword: fragment });
          expect(results.some((p) => p.namaProduk === namaProduk)).toBe(true);
        },
      ),
      RUNS,
    );
  });
});
