/**
 * Prisma client singleton + persistence factory.
 *
 * A single PrismaClient is reused across requests (and across dev HMR reloads
 * via globalThis) to avoid exhausting database connections on serverless.
 * `getPrismaPersistence` wraps it in the {@link PrismaPersistence} adapter that
 * implements the repository ports.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPersistence } from "./index";

interface PrismaGlobal {
  __pmsPrisma?: PrismaClient;
}

const prismaGlobal = globalThis as unknown as PrismaGlobal;

/** Lazily create and memoize the shared PrismaClient. */
export function getPrismaClient(): PrismaClient {
  if (!prismaGlobal.__pmsPrisma) {
    prismaGlobal.__pmsPrisma = new PrismaClient();
  }
  return prismaGlobal.__pmsPrisma;
}

/** Build the Prisma-backed persistence adapter over the shared client. */
export function getPrismaPersistence(): PrismaPersistence {
  return new PrismaPersistence(getPrismaClient());
}
