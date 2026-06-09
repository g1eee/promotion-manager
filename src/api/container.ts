/**
 * Server-side dependency container for the API layer (MVP).
 *
 * Wires the in-memory persistence adapter to the application services and
 * exposes them to Next.js Route Handlers. A single {@link InMemoryPersistence}
 * instance is shared across all requests in the running server process and
 * stashed on `globalThis` so it survives module reloads (e.g. Next.js dev HMR),
 * keeping state consistent between requests within a session.
 *
 * MVP NOTE: this is an in-memory store, not a database. It is the same
 * temporary, process-local strategy used by the seed auth users (`auth/users`)
 * until the Prisma persistence adapter lands. Swapping in a DB-backed adapter
 * is a drop-in change because services depend only on repository ports.
 */

import { BrandStatus } from "@domain/enums";
import type { Brand } from "@domain/types";
import { InMemoryPersistence } from "@persistence/in-memory";
import { BrandService } from "@services/brand-service";

interface PmsGlobal {
  __pmsPersistence?: InMemoryPersistence;
  __pmsSeedPromise?: Promise<void>;
}

const pmsGlobal = globalThis as unknown as PmsGlobal;

/** A seeded sample Brand mirroring the sample list used by the UI shell. */
function sampleBrand(
  id: string,
  brandId: string,
  brandName: string,
): Brand {
  const now = new Date();
  return {
    id,
    brandId,
    brandName,
    displayName: brandName,
    status: BrandStatus.Active,
    createdBy: "user-spv",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The four sample Brands (Kalova, Chanira, AMK, ATRIA) seeded once so the
 * management screen and other modules have data to work with on first run.
 */
const SAMPLE_BRANDS: readonly Brand[] = [
  sampleBrand("brand-kalova", "KALOVA", "Kalova"),
  sampleBrand("brand-chanira", "CHANIRA", "Chanira"),
  sampleBrand("brand-amk", "AMK", "AMK"),
  sampleBrand("brand-atria", "ATRIA", "ATRIA"),
];

/** Lazily create and memoize the shared persistence instance. */
function getPersistence(): InMemoryPersistence {
  if (!pmsGlobal.__pmsPersistence) {
    pmsGlobal.__pmsPersistence = new InMemoryPersistence();
  }
  return pmsGlobal.__pmsPersistence;
}

/** Seed the sample Brands exactly once for the process. */
async function ensureSeeded(persistence: InMemoryPersistence): Promise<void> {
  if (!pmsGlobal.__pmsSeedPromise) {
    pmsGlobal.__pmsSeedPromise = (async () => {
      for (const brand of SAMPLE_BRANDS) {
        try {
          await persistence.brands.insert(brand);
        } catch {
          // Already present (idempotent seed); ignore duplicate inserts.
        }
      }
    })();
  }
  await pmsGlobal.__pmsSeedPromise;
}

/** The services exposed to Route Handlers. */
export interface ApiContainer {
  readonly persistence: InMemoryPersistence;
  readonly brandService: BrandService;
}

/**
 * Resolve the API container, ensuring the store is seeded before first use.
 * Route Handlers `await getContainer()` then call the relevant service.
 */
export async function getContainer(): Promise<ApiContainer> {
  const persistence = getPersistence();
  await ensureSeeded(persistence);
  return {
    persistence,
    brandService: new BrandService({ brands: persistence.brands }),
  };
}
