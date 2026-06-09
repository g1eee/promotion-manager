/**
 * Role-based UI route guards (Task 3.2 — Session Management & route guards).
 *
 * Pure, edge-safe helpers (no I/O, no Node APIs) so they can run both inside
 * Next.js middleware (Edge runtime) and in plain unit tests. They encode WHICH
 * routes belong to configuration modules and WHO may see them at the UI layer.
 *
 * IMPORTANT — convenience layer only (Req 1.6).
 * These guards make the UI pleasant by keeping Admin_Marketplace away from
 * configuration screens they cannot use. They are NOT the real access enforcer:
 * the API layer (AccessController / RBAC, Task 4 onward) remains the single
 * source of truth that rejects unauthorized create/update requests. UI hiding
 * + redirects can always be bypassed (direct fetch, disabled JS), so the server
 * must re-check every mutating request regardless of what this guard allows.
 *
 * The protected prefixes mirror the SPV-only items in `nav-config.ts`
 * (design.md → "Navigasi berbasis peran"):
 *   - Master Data: Product Master, Cost Configuration, Promo Templates.
 *   - Settings: Brand Management.
 *   - Promo Management: Campaign + Promo Scenario creation/management.
 */

import { Role } from "@domain/enums";

/**
 * Route prefixes for configuration modules that only SPV_Marketing may access
 * in the UI. A request matches when its pathname equals a prefix exactly or is
 * nested beneath it (e.g. `/master/products/123` matches `/master`).
 */
export const SPV_ONLY_PATH_PREFIXES = [
  // Master Data — Product Master, Cost Configuration, Promo Templates.
  "/master",
  // Settings — Brand Management.
  "/settings",
  // Promo Management — Campaign creation/management.
  "/promo/campaigns",
  // Promo Management — Promo Scenario creation/management.
  "/promo/scenarios",
] as const;

/**
 * Where a blocked Admin_Marketplace user is redirected. Promo Execution is the
 * Admin landing point (the Approved-promos board they actually work from), per
 * design.md → "Navigasi berbasis peran".
 */
export const ADMIN_FALLBACK_PATH = "/promo/execution";

/** True when `pathname` belongs to an SPV-only configuration module. */
export function isSpvOnlyPath(pathname: string): boolean {
  return SPV_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * UI access decision for a role + path.
 *
 * Only Admin_Marketplace is restricted (from SPV-only configuration modules);
 * SPV_Marketing sees the full interface. This intentionally does not enforce
 * write permissions — that is the API's job (Req 1.6).
 */
export function isUiAccessAllowed(role: Role, pathname: string): boolean {
  if (role === Role.Admin_Marketplace && isSpvOnlyPath(pathname)) {
    return false;
  }
  return true;
}
