import { beforeEach, describe, expect, it } from "vitest";

import { BenefitType, PromoType, type PromoTemplateConfig } from "../domain";
import { InMemoryPersistence, NotFoundError } from "../persistence";
import {
  BUILT_IN_TEMPLATES,
  PromoTemplateService,
} from "./promo-template-service";
import { ValidationError } from "./errors";

function discountConfig(percent: number): PromoTemplateConfig {
  return {
    rules: [
      {
        minQuantity: 1,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: percent,
        gift: null,
      },
    ],
  };
}

describe("PromoTemplateService", () => {
  let persistence: InMemoryPersistence;
  let service: PromoTemplateService;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
    service = new PromoTemplateService({ templates: persistence.promoTemplates });
  });

  it("seeds the five built-in templates (Req 5.1)", async () => {
    await service.ensureSeeded();
    const templates = await service.list();

    expect(templates).toHaveLength(5);
    expect(templates.map((template) => template.name).sort()).toEqual(
      [
        "Buy X Discount Y%",
        "Buy X Get Free Gift",
        "Bundle Promo",
        "Flash Sale",
        "Voucher Discount",
      ].sort(),
    );
    expect(templates.every((template) => template.isBuiltIn)).toBe(true);
  });

  it("seeds idempotently without duplicating built-ins", async () => {
    await service.ensureSeeded();
    await service.ensureSeeded();
    const templates = await service.list();
    expect(templates).toHaveLength(BUILT_IN_TEMPLATES.length);
  });

  it("creates an unlimited number of custom templates (Req 5.2, 5.3)", async () => {
    for (let index = 0; index < 12; index += 1) {
      await service.create(
        {
          name: `Custom ${index}`,
          promoType: PromoType.Voucher,
          config: discountConfig(5 + index),
        },
        "user-spv",
      );
    }
    const templates = await service.list();
    expect(templates).toHaveLength(12);
    expect(templates.every((template) => template.isBuiltIn === false)).toBe(true);
  });

  it("updates a template and preserves it on save (Req 5.4)", async () => {
    const created = await service.create(
      { name: "Original", promoType: PromoType.FlashSale, config: discountConfig(10) },
      "user-spv",
    );

    const updated = await service.update(created.id, {
      name: "Renamed",
      promoType: PromoType.FlashSale,
      config: discountConfig(30),
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.config.rules[0]?.discountPercent).toBe(30);

    const persisted = await persistence.promoTemplates.findById(created.id);
    expect(persisted?.name).toBe("Renamed");
  });

  it("deletes a template from the list (Req 5.5)", async () => {
    const created = await service.create(
      { name: "Temp", promoType: PromoType.Voucher, config: discountConfig(10) },
      "user-spv",
    );

    await service.delete(created.id);

    const templates = await service.list();
    expect(templates.find((template) => template.id === created.id)).toBeUndefined();
  });

  it("rejects a blank name and preserves data without partial writes (Req 5.6)", async () => {
    await expect(
      service.create(
        { name: "   ", promoType: PromoType.Voucher, config: discountConfig(10) },
        "user-spv",
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await service.list()).toHaveLength(0);
  });

  it("rejects an invalid config (min quantity < 1)", async () => {
    await expect(
      service.create(
        {
          name: "Bad",
          promoType: PromoType.Voucher,
          config: {
            rules: [
              {
                minQuantity: 0,
                benefitType: BenefitType.DiscountPercent,
                discountPercent: 10,
                gift: null,
              },
            ],
          },
        },
        "user-spv",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("maps updating a missing template to NotFoundError", async () => {
    await expect(
      service.update("missing", {
        name: "X",
        promoType: PromoType.Voucher,
        config: discountConfig(10),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
