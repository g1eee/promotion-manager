import { beforeEach, describe, expect, it } from "vitest";

import { BrandStatus, type Brand } from "../domain";
import { ForeignKeyError, InMemoryPersistence } from "../persistence";
import {
  COST_COMPONENT_KEYS,
  CostConfigService,
  type CostComponents,
} from "./cost-config-service";
import { ValidationError } from "./errors";

/** Build a valid set of components, overriding individual fields as needed. */
function components(overrides: Partial<CostComponents> = {}): CostComponents {
  const base = Object.fromEntries(
    COST_COMPONENT_KEYS.map((k) => [k, 5]),
  ) as CostComponents;
  return { ...base, ...overrides };
}

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

describe("CostConfigService", () => {
  let persistence: InMemoryPersistence;
  let service: CostConfigService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CostConfigService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
  });

  it("get returns an inactive zeroed default when not yet configured", async () => {
    const config = await service.get("brand-kalova");
    expect(config.isActive).toBe(false);
    for (const key of COST_COMPONENT_KEYS) {
      expect(config[key]).toBe(0);
    }
  });

  it("update persists all ten components as the active configuration (Req 4.1, 4.3)", async () => {
    const input = components({ adminFee: 8, shippingFee: 12, operatingCost: 100 });
    const saved = await service.update("brand-kalova", input);

    expect(saved.isActive).toBe(true);
    expect(saved.brandId).toBe("brand-kalova");
    for (const key of COST_COMPONENT_KEYS) {
      expect(saved[key]).toBe(input[key]);
    }

    const reloaded = await service.get("brand-kalova");
    expect(reloaded.adminFee).toBe(8);
    expect(reloaded.shippingFee).toBe(12);
    expect(reloaded.operatingCost).toBe(100);
  });

  it("update accepts the inclusive boundaries 0 and 100", async () => {
    const saved = await service.update(
      "brand-kalova",
      components({ adminFee: 0, operatingCost: 100 }),
    );
    expect(saved.adminFee).toBe(0);
    expect(saved.operatingCost).toBe(100);
  });

  it("rejects the entire update atomically when any component is out of range (Req 4.5)", async () => {
    // Seed a valid configuration first.
    await service.update("brand-kalova", components({ adminFee: 8 }));

    await expect(
      service.update("brand-kalova", components({ adminFee: 50, marketingFee: 150 })),
    ).rejects.toBeInstanceOf(ValidationError);

    // Stored configuration must be unchanged (adminFee stays 8, not 50).
    const reloaded = await service.get("brand-kalova");
    expect(reloaded.adminFee).toBe(8);
    expect(reloaded.marketingFee).toBe(5);
  });

  it("rejects negative and non-finite values, naming offending fields", async () => {
    try {
      await service.update(
        "brand-kalova",
        components({ adminFee: -1, shippingFee: Number.NaN }),
      );
      expect.unreachable("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const fields = (error as ValidationError).fields;
      expect(fields.adminFee).toBeDefined();
      expect(fields.shippingFee).toBeDefined();
      expect(fields.marketingFee).toBeUndefined();
    }
  });

  it("isolates configuration between Brands (Req 4.2 / Property 12)", async () => {
    await service.update("brand-kalova", components({ adminFee: 8 }));
    await service.update("brand-amk", components({ adminFee: 10 }));

    const kalova = await service.get("brand-kalova");
    const amk = await service.get("brand-amk");
    expect(kalova.adminFee).toBe(8);
    expect(amk.adminFee).toBe(10);

    // Updating AMK leaves Kalova untouched.
    await service.update("brand-amk", components({ adminFee: 20 }));
    const kalovaAfter = await service.get("brand-kalova");
    expect(kalovaAfter.adminFee).toBe(8);
  });

  it("rejects first-time configuration for a non-existent Brand", async () => {
    await expect(
      service.update("brand-missing", components()),
    ).rejects.toBeInstanceOf(ForeignKeyError);
  });
});
