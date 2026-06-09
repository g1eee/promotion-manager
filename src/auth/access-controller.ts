/**
 * AccessController — Role-Based Access Control decision logic (Task 4.1, Req 1).
 *
 * Pure, framework-agnostic, edge-safe (no I/O, no Node APIs) so it can run in
 * Next.js Route Handlers, middleware, and plain unit tests alike. This is the
 * SINGLE SOURCE OF TRUTH for write enforcement (Req 1.6): every mutating API
 * request MUST pass through {@link authorize} before the domain operation runs.
 * The UI route guards (`route-guards.ts`) are only a convenience layer and can
 * be bypassed; this controller cannot.
 *
 * Rules encoded here (design.md → "Lapisan RBAC", Components & Interfaces →
 * "Authentication & Access Control"):
 *   - SPV_Marketing holds full write authority over the FIVE controlled
 *     resources (Campaign, Promo_Scenario, Product_Master, Cost_Configuration,
 *     Promo_Template) as a single all-or-nothing grant (Req 1.2). It may also
 *     read promos and create Feedback_Record (Req 1.4).
 *   - Admin_Marketplace is denied every write on the five resources (Req 1.6),
 *     and is restricted to reading Promo_Scenario (the Approved board) and
 *     creating Feedback_Record on promos it can access (Req 1.3, 1.5).
 *
 * Account→role mapping is "exactly one role per account" (Req 1.1): the role is
 * a single scalar on the authenticated session/user (see `auth/types.ts` and
 * `auth/users.ts`), never a list. {@link authorize} therefore decides purely
 * from that one role.
 */

import { Role } from "@domain/enums";

/**
 * Operations the access controller reasons about. Create/Update are the
 * "write" actions gated by the all-or-nothing rule; Read is non-mutating.
 */
export enum AccessAction {
  Create = "Create",
  Update = "Update",
  Read = "Read",
}

/**
 * Resource types subject to access control. The first five are the canonical
 * write-controlled resources (Req 1.2/1.6); Feedback_Record is the two-way
 * discussion thread any role with promo access may append to (Req 1.5).
 * Values mirror the canonical labels used across the design.
 */
export enum AccessResource {
  Campaign = "Campaign",
  PromoScenario = "Promo_Scenario",
  ProductMaster = "Product_Master",
  CostConfiguration = "Cost_Configuration",
  PromoTemplate = "Promo_Template",
  FeedbackRecord = "Feedback_Record",
  /**
   * Brand Management (Req 19). Not one of the five write-controlled resources
   * gated by the all-or-nothing rule (Req 1.2), but still an SPV-only
   * configuration module: SPV_Marketing may write it, Admin_Marketplace is
   * denied every action on it (handled by the default deny in
   * {@link authorizeAdminMarketplace}).
   */
  Brand = "Brand",
}

/**
 * The five resources whose create/update access is granted all-or-nothing to
 * SPV_Marketing and denied wholesale to Admin_Marketplace (Req 1.2, 1.6).
 */
export const WRITE_CONTROLLED_RESOURCES: readonly AccessResource[] = [
  AccessResource.Campaign,
  AccessResource.PromoScenario,
  AccessResource.ProductMaster,
  AccessResource.CostConfiguration,
  AccessResource.PromoTemplate,
];

/** Actions that mutate state and are therefore gated by the write rules. */
const WRITE_ACTIONS: readonly AccessAction[] = [
  AccessAction.Create,
  AccessAction.Update,
];

/**
 * The authenticated subject the decision is made for. Carries exactly one role
 * (Req 1.1); compatible with the NextAuth session user shape.
 */
export interface AuthorizationSubject {
  readonly role: Role;
}

/**
 * Result of an authorization check: either an `Allow`, or a `Deny` carrying a
 * human-readable access-denied message for the caller to surface (Req 1.6).
 */
export type AuthorizationDecision =
  | { readonly effect: "Allow" }
  | { readonly effect: "Deny"; readonly message: string };

/** The single, shared `Allow` decision. */
export const Allow: AuthorizationDecision = { effect: "Allow" };

/** Construct a `Deny` decision carrying an access-denied message (Req 1.6). */
export function Deny(message: string): AuthorizationDecision {
  return { effect: "Deny", message };
}

/** Type guard: is this decision an allow? */
export function isAllowed(decision: AuthorizationDecision): boolean {
  return decision.effect === "Allow";
}

/** True when `action` mutates state (Create/Update). */
export function isWriteAction(action: AccessAction): boolean {
  return WRITE_ACTIONS.includes(action);
}

/** True when `resource` is one of the five write-controlled resources. */
export function isWriteControlledResource(resource: AccessResource): boolean {
  return WRITE_CONTROLLED_RESOURCES.includes(resource);
}

/** Build the access-denied message shown when a request is rejected (Req 1.6). */
function accessDeniedMessage(
  action: AccessAction,
  resource: AccessResource,
): string {
  return `Akses ditolak: peran Admin_Marketplace tidak diizinkan melakukan aksi ${action} pada ${resource}.`;
}

/**
 * Authorization rules for Admin_Marketplace (Req 1.3, 1.5, 1.6).
 *
 * Allowed: read Promo_Scenario (the Approved board) and the Feedback_Record
 * thread, plus creating Feedback_Record. Everything else — most notably any
 * create/update on the five controlled resources — is denied.
 */
function authorizeAdminMarketplace(
  action: AccessAction,
  resource: AccessResource,
): AuthorizationDecision {
  // Creating feedback is allowed for any role with promo access (Req 1.5).
  if (resource === AccessResource.FeedbackRecord) {
    if (action === AccessAction.Create || action === AccessAction.Read) {
      return Allow;
    }
    return Deny(accessDeniedMessage(action, resource));
  }

  // Read-only access to promos — the Approved board the Admin works from
  // (Req 1.3). Status filtering to Approved is enforced by the data layer
  // (AdminExecutionBoard.list, Task 15), not by this resource-level decision.
  if (resource === AccessResource.PromoScenario && action === AccessAction.Read) {
    return Allow;
  }

  // Everything else is denied — including all writes on the five controlled
  // resources (Req 1.6) and reads of configuration resources outside the
  // Admin's simplified interface (Req 1.3).
  return Deny(accessDeniedMessage(action, resource));
}

/**
 * Decide whether `user` may perform `action` on `resourceType`.
 *
 * - SPV_Marketing: full authority — all writes on the five resources as a
 *   single all-or-nothing grant, plus reads and feedback creation (Req 1.2,
 *   1.4). Always `Allow`.
 * - Admin_Marketplace: restricted to reading promos and creating feedback;
 *   every write on the five resources is denied with an access-denied message
 *   (Req 1.3, 1.5, 1.6).
 *
 * @param user The authenticated subject (exactly one role, Req 1.1).
 * @param action The operation being attempted.
 * @param resourceType The resource the operation targets.
 */
export function authorize(
  user: AuthorizationSubject,
  action: AccessAction,
  resourceType: AccessResource,
): AuthorizationDecision {
  switch (user.role) {
    // SPV_Marketing carries full write authority over all five resources as a
    // single grant (all-or-nothing, Req 1.2) and may also read + give feedback.
    case Role.SPV_Marketing:
      return Allow;

    case Role.Admin_Marketplace:
      return authorizeAdminMarketplace(action, resourceType);

    default:
      // Exhaustive over Role; defensive deny for an unrecognized role keeps the
      // controller fail-closed.
      return Deny(
        "Akses ditolak: peran pengguna tidak dikenali.",
      );
  }
}

/**
 * The single `AccessController` surface referenced by the design
 * (`AccessController.authorize`). Provided as a namespaced object for callers
 * that prefer `AccessController.authorize(...)`; the standalone `authorize`
 * export remains available for direct import.
 */
export const AccessController = {
  authorize,
} as const;
