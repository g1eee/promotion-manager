import { describe, expect, it } from "vitest";
import { Role } from "@domain/enums";
import { findSeedUser, seedUsers, type SeedUser } from "./users";
import {
  ADMIN_FALLBACK_PATH,
  SPV_ONLY_PATH_PREFIXES,
  isSpvOnlyPath,
  isUiAccessAllowed,
} from "./route-guards";

/**
 * Unit tests for Authentication & Session (Task 3.3).
 *
 * Covers two acceptance criteria of Requirement 1 (Otentikasi & RBAC):
 *   - Req 1.1: setiap akun pengguna diasosiasikan dengan tepat satu peran
 *     (SPV_Marketing atau Admin_Marketplace).
 *   - Req 1.6: Admin_Marketplace ditolak ketika mengakses fungsi
 *     pembuatan/pengubahan konfigurasi (Product Master, Cost Configuration,
 *     Promo Template, Campaign, Promo Scenario), sementara SPV_Marketing
 *     diizinkan.
 *
 * Validates: Requirements 1.1, 1.6
 */

const VALID_ROLES = new Set<Role>(Object.values(Role));

describe("Authentication — exactly one role per account (Req 1.1)", () => {
  it("associates every seed account with exactly one valid role", () => {
    expect(seedUsers.length).toBeGreaterThan(0);

    for (const user of seedUsers) {
      // `role` is a single scalar (never a list) and is always present.
      expect(typeof user.role).toBe("string");
      expect(Array.isArray(user.role)).toBe(false);
      // The single role must be one of the two defined domain roles.
      expect(VALID_ROLES.has(user.role)).toBe(true);
    }
  });

  it("covers both defined roles with stable, unique account ids", () => {
    const roles = seedUsers.map((user) => user.role);
    expect(roles).toContain(Role.SPV_Marketing);
    expect(roles).toContain(Role.Admin_Marketplace);

    const ids = seedUsers.map((user) => user.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("authorizes valid credentials and returns the account's single role", () => {
    const spv = seedUsers.find((u) => u.role === Role.SPV_Marketing) as SeedUser;
    const admin = seedUsers.find(
      (u) => u.role === Role.Admin_Marketplace,
    ) as SeedUser;

    const authedSpv = findSeedUser(spv.email, spv.password);
    expect(authedSpv).not.toBeNull();
    expect(authedSpv?.role).toBe(Role.SPV_Marketing);

    const authedAdmin = findSeedUser(admin.email, admin.password);
    expect(authedAdmin).not.toBeNull();
    expect(authedAdmin?.role).toBe(Role.Admin_Marketplace);
  });

  it("rejects invalid credentials and malformed input (no role granted)", () => {
    const spv = seedUsers.find((u) => u.role === Role.SPV_Marketing) as SeedUser;

    expect(findSeedUser(spv.email, "wrong-password")).toBeNull();
    expect(findSeedUser("nobody@pms.local", "whatever")).toBeNull();
    expect(findSeedUser(undefined, undefined)).toBeNull();
    expect(findSeedUser("", "")).toBeNull();
  });
});

describe("Route guards — deny Admin_Marketplace config routes (Req 1.6)", () => {
  // Representative configuration routes for the five protected resource modules.
  const configRoutes = [
    "/master/products", // Product Master
    "/master/cost-configuration", // Cost Configuration
    "/master/templates", // Promo Templates
    "/promo/campaigns", // Campaign creation/management
    "/promo/scenarios", // Promo Scenario creation/management
    "/settings/brand-management", // Brand Management (settings)
  ];

  // Routes Admin_Marketplace is allowed to use.
  const adminAllowedRoutes = ["/promo/execution", "/dashboard"];

  it("flags every SPV-only prefix (and nested paths) as SPV-only", () => {
    for (const prefix of SPV_ONLY_PATH_PREFIXES) {
      expect(isSpvOnlyPath(prefix)).toBe(true);
      expect(isSpvOnlyPath(`${prefix}/123`)).toBe(true);
    }
  });

  it("denies Admin_Marketplace access to every configuration route", () => {
    for (const route of configRoutes) {
      expect(isUiAccessAllowed(Role.Admin_Marketplace, route)).toBe(false);
    }
  });

  it("allows SPV_Marketing access to all configuration routes", () => {
    for (const route of configRoutes) {
      expect(isUiAccessAllowed(Role.SPV_Marketing, route)).toBe(true);
    }
  });

  it("allows Admin_Marketplace access to its own (non-config) routes", () => {
    for (const route of adminAllowedRoutes) {
      expect(isSpvOnlyPath(route)).toBe(false);
      expect(isUiAccessAllowed(Role.Admin_Marketplace, route)).toBe(true);
    }
  });

  it("redirects blocked Admin_Marketplace users to a non-SPV-only fallback", () => {
    // The fallback itself must be reachable by Admin_Marketplace, otherwise the
    // guard would loop redirecting.
    expect(isSpvOnlyPath(ADMIN_FALLBACK_PATH)).toBe(false);
    expect(isUiAccessAllowed(Role.Admin_Marketplace, ADMIN_FALLBACK_PATH)).toBe(
      true,
    );
  });
});
