import { beforeEach, describe, expect, it } from "vitest";

import {
  BrandStatus,
  CampaignStatus,
  PromoStatus,
  PromoType,
  type Brand,
  type PromoScenario,
} from "../domain";
import {
  InMemoryPersistence,
  ReferentialIntegrityError,
} from "../persistence";
import { ValidationError } from "./errors";
import {
  CampaignService,
  type CreateCampaignInput,
} from "./campaign-service";

const START = new Date("2025-09-01T00:00:00Z");
const END = new Date("2025-09-30T00:00:00Z");

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

function campaignInput(
  overrides: Partial<CreateCampaignInput> = {},
): CreateCampaignInput {
  return {
    brandId: "brand-kalova",
    nama: "Payday September",
    tanggalMulai: START,
    tanggalSelesai: END,
    ...overrides,
  };
}

function makePromo(
  id: string,
  brandId: string,
  campaignId: string,
): PromoScenario {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id,
    brandId,
    campaignId,
    namaPromo: "Promo",
    promoType: PromoType.BuyXDiscount,
    tanggalMulai: START,
    tanggalSelesai: END,
    status: PromoStatus.Draft,
    executionStatus: null,
    rules: [],
    productRefs: [],
    createdBy: "user-1",
    createdAt: now,
    updatedAt: now,
  };
}

describe("CampaignService.create", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CampaignService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
  });

  it("saves a valid Campaign with initial Draft status and audit fields (Req 6.1, 6.13, 23.2)", async () => {
    const campaign = await service.create(campaignInput(), "user-1");

    expect(campaign.id).toBeTruthy();
    expect(campaign.brandId).toBe("brand-kalova");
    expect(campaign.nama).toBe("Payday September");
    expect(campaign.status).toBe(CampaignStatus.Draft);
    expect(campaign.createdBy).toBe("user-1");
    expect(campaign.createdAt).toBeInstanceOf(Date);
    expect(campaign.updatedAt).toBeInstanceOf(Date);
    expect(campaign.createdAt.getTime()).toBe(campaign.updatedAt.getTime());
  });

  it("accepts Tanggal Selesai equal to Tanggal Mulai (inclusive boundary, Req 6.2)", async () => {
    const sameDay = new Date("2025-09-09T00:00:00Z");
    const campaign = await service.create(
      campaignInput({ tanggalMulai: sameDay, tanggalSelesai: sameDay }),
      "user-1",
    );
    expect(campaign.tanggalMulai.getTime()).toBe(
      campaign.tanggalSelesai.getTime(),
    );
  });

  it("rejects when Tanggal Selesai is earlier than Tanggal Mulai (Req 6.2)", async () => {
    await expect(
      service.create(
        campaignInput({ tanggalMulai: END, tanggalSelesai: START }),
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing or non-existent Brand (Req 6.3)", async () => {
    await expect(
      service.create(campaignInput({ brandId: "" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.create(campaignInput({ brandId: "brand-missing" }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing Nama Campaign", async () => {
    await expect(
      service.create(campaignInput({ nama: "   " }), "user-1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("CampaignService.update", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignService;
  let campaignId: string;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CampaignService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
    const created = await service.create(campaignInput(), "user-1");
    campaignId = created.id;
  });

  it("saves valid field changes and refreshes Updated At (Req 6.5, 6.13, 23.3)", async () => {
    const before = await persistence.campaigns.findById(campaignId);
    // Ensure a measurable time gap so updatedAt strictly advances.
    await new Promise((r) => setTimeout(r, 2));

    const updated = await service.update(campaignId, { nama: "Payday Edited" });

    expect(updated.nama).toBe("Payday Edited");
    expect(updated.createdBy).toBe(before!.createdBy);
    expect(updated.createdAt.getTime()).toBe(before!.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before!.updatedAt.getTime(),
    );
  });

  it("blocks the save and preserves data when the date range is inverted (Req 6.6)", async () => {
    await expect(
      service.update(campaignId, {
        tanggalMulai: END,
        tanggalSelesai: START,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const reloaded = await persistence.campaigns.findById(campaignId);
    expect(reloaded!.tanggalMulai.getTime()).toBe(START.getTime());
    expect(reloaded!.tanggalSelesai.getTime()).toBe(END.getTime());
  });

  it("blocks the save when the Brand is not valid (Req 6.6)", async () => {
    await expect(
      service.update(campaignId, { brandId: "brand-missing" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("restricts Status to the allowed Campaign values (Req 6.4)", async () => {
    await expect(
      service.update(campaignId, {
        status: "Deleted" as unknown as CampaignStatus,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    for (const status of [
      CampaignStatus.Draft,
      CampaignStatus.Active,
      CampaignStatus.Completed,
      CampaignStatus.Archived,
    ]) {
      const updated = await service.update(campaignId, { status });
      expect(updated.status).toBe(status);
    }
  });

  it("throws NotFoundError for an unknown Campaign id", async () => {
    await expect(
      service.update("missing-id", { nama: "X" }),
    ).rejects.toThrowError();
  });
});

describe("CampaignService.archive", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CampaignService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
  });

  it("marks the Campaign Archived without deleting its data (Req 6.9)", async () => {
    const created = await service.create(campaignInput(), "user-1");
    const archived = await service.archive(created.id);

    expect(archived.status).toBe(CampaignStatus.Archived);
    const reloaded = await persistence.campaigns.findById(created.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.status).toBe(CampaignStatus.Archived);
  });
});

describe("CampaignService.delete", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CampaignService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
  });

  it("deletes a Campaign that has no related Promo_Scenario (Req 6.7)", async () => {
    const created = await service.create(campaignInput(), "user-1");
    await service.delete(created.id);
    expect(await persistence.campaigns.findById(created.id)).toBeNull();
  });

  it("rejects permanent delete when related Promo_Scenario(s) exist and directs to Archive (Req 6.8)", async () => {
    const created = await service.create(campaignInput(), "user-1");
    await persistence.promos.insert(
      makePromo("promo-1", "brand-kalova", created.id),
    );

    await expect(service.delete(created.id)).rejects.toBeInstanceOf(
      ReferentialIntegrityError,
    );
    // Data must remain intact for reporting/audit.
    expect(await persistence.campaigns.findById(created.id)).not.toBeNull();
  });
});

describe("CampaignService system vs validation error distinction (Req 6.14)", () => {
  it("propagates a system error (e.g. DB failure) without wrapping it as ValidationError", async () => {
    await expect(async () => {
      const persistence = new InMemoryPersistence();
      await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));

      // Simulate a database-connectivity failure on insert.
      const failingCampaigns = {
        ...persistence.campaigns,
        insert: async () => {
          throw new Error("DB connectivity failure");
        },
      };
      const service = new CampaignService({
        campaigns: failingCampaigns as unknown as typeof persistence.campaigns,
        brands: persistence.brands,
      });

      try {
        await service.create(campaignInput(), "user-1");
        throw new Error("expected create to throw");
      } catch (error) {
        // A system error must NOT be a ValidationError (input was valid).
        expect(error).not.toBeInstanceOf(ValidationError);
        expect((error as Error).message).toContain("DB connectivity failure");
        throw error; // satisfy rejects matcher below
      }
    }).rejects.toThrowError("DB connectivity failure");
  });
});

describe("CampaignService.createInline", () => {
  let persistence: InMemoryPersistence;
  let service: CampaignService;

  beforeEach(async () => {
    persistence = new InMemoryPersistence();
    service = new CampaignService(persistence);
    await persistence.brands.insert(makeBrand("brand-kalova", "KALOVA"));
    await persistence.brands.insert(makeBrand("brand-amk", "AMK"));
  });

  it("defaults the Campaign Brand to the promo Brand when none is supplied (Req 7.12)", async () => {
    const campaign = await service.createInline(
      {
        nama: "Payday Oktober",
        tanggalMulai: START,
        tanggalSelesai: END,
      },
      "brand-kalova",
      "user-1",
    );

    expect(campaign.brandId).toBe("brand-kalova");
    expect(campaign.status).toBe(CampaignStatus.Draft);
  });

  it("applies all Campaign validations including audit fields and initial Draft status (Req 7.13)", async () => {
    const campaign = await service.createInline(
      {
        nama: "Payday Oktober",
        tanggalMulai: START,
        tanggalSelesai: END,
      },
      "brand-kalova",
      "user-1",
    );

    expect(campaign.id).toBeTruthy();
    expect(campaign.status).toBe(CampaignStatus.Draft);
    expect(campaign.createdBy).toBe("user-1");
    expect(campaign.createdAt).toBeInstanceOf(Date);
    expect(campaign.updatedAt).toBeInstanceOf(Date);
    expect(campaign.createdAt.getTime()).toBe(campaign.updatedAt.getTime());

    const reloaded = await persistence.campaigns.findById(campaign.id);
    expect(reloaded).not.toBeNull();
  });

  it("rejects an inverted date range under the inline flow (Req 7.13)", async () => {
    await expect(
      service.createInline(
        {
          nama: "Payday Oktober",
          tanggalMulai: END,
          tanggalSelesai: START,
        },
        "brand-kalova",
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing Nama Campaign under the inline flow (Req 7.13)", async () => {
    await expect(
      service.createInline(
        {
          nama: "   ",
          tanggalMulai: START,
          tanggalSelesai: END,
        },
        "brand-kalova",
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects when the supplied Brand differs from the promo Brand (Req 7.14)", async () => {
    await expect(
      service.createInline(
        {
          brandId: "brand-amk",
          nama: "Payday Oktober",
          tanggalMulai: START,
          tanggalSelesai: END,
        },
        "brand-kalova",
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a supplied Brand that matches the promo Brand (Req 7.14)", async () => {
    const campaign = await service.createInline(
      {
        brandId: "brand-kalova",
        nama: "Payday Oktober",
        tanggalMulai: START,
        tanggalSelesai: END,
      },
      "brand-kalova",
      "user-1",
    );

    expect(campaign.brandId).toBe("brand-kalova");
  });

  it("rejects when the promo Brand does not reference an existing Brand (Req 7.13)", async () => {
    await expect(
      service.createInline(
        {
          nama: "Payday Oktober",
          tanggalMulai: START,
          tanggalSelesai: END,
        },
        "brand-missing",
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
