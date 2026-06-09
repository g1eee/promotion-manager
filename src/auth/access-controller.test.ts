import { describe, expect, it } from "vitest";
import { Role } from "@domain/enums";
import { seedUsers } from "./users";
import {
  AccessController,
  AccessAction,
  AccessResource,
  WRITE_CONTROLLED_RESOURCES,
  authorize,
  isAllowed,
  isWriteAction,
  isWriteControlledResource,
  type AuthorizationSubject,
} from "./access-controller";

/**
 * Unit tests for AccessController RBAC decision logic and role assignment
 * (Task 4.2, Requirement 1).
 *
 * Covers:
 *   - Req 1.1: setiap akun pengguna diasosiasikan dengan tepat satu peran
 *     (SPV_Marketing atau Admin_Marketplace).
 *   - Req 1.2: SPV_Marketing memegang otoritas tulis penuh atas kelima sumber
 *     daya terkontrol sebagai satu hibah all-or-nothing.
 *   - Req 1.3: Admin_Marketplace dibatasi pada melihat Promo_Scenario (papan
 *     Approved) dan mengirim feedback implementasi.
 *   - Req 1.6: Admin_Marketplace ditolak melakukan create/modify atas kelima
 *     sumber daya dengan pesan akses ditolak.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.6
 */

const SPV: AuthorizationSubject = { role: Role.SPV_Marketing };
const ADMIN: AuthorizationSubject = { role: Role.Admin_Marketplace };

const VALID_ROLES = new Set<Role>(Object.values(Role));

const WRITE_ACTIONS = [AccessAction.Create, AccessAction.Update] as const;

describe("Role assignment — exactly one role per account (Req 1.1)", () => {
  it("binds every seed account to exactly one valid scalar role", () => {
    expect(seedUsers.length).toBeGreaterThan(0);

    for (const user of seedUsers) {
      // role is a single scalar (never a list) and always one of the two roles.
      expect(typeof user.role).toBe("string");
      expect(Array.isArray(user.role)).toBe(false);
      expect(VALID_ROLES.has(user.role)).toBe(true);
    }
  });

  it("defines exactly the two domain roles, no more", () => {
    expect([...VALID_ROLES].sort()).toEqual(
      [Role.Admin_Marketplace, Role.SPV_Marketing].sort(),
    );
  });
});

describe("SPV_Marketing — all-or-nothing write authority (Req 1.2)", () => {
  it("allows create AND update on every one of the five controlled resources", () => {
    // All-or-nothing: SPV must be granted writes uniformly across all five.
    for (const resource of WRITE_CONTROLLED_RESOURCES) {
      for (const action of WRITE_ACTIONS) {
        const decision = authorize(SPV, action, resource);
        expect(decision.effect).toBe("Allow");
        expect(isAllowed(decision)).toBe(true);
      }
    }
  });

  it("grants writes to all five resources as a single uniform grant (no partial access)", () => {
    // Collect the allow-state for create on each resource; the set must be a
    // single value (all true) — never a mix of allow/deny.
    const allowStates = WRITE_CONTROLLED_RESOURCES.map((resource) =>
      isAllowed(authorize(SPV, AccessAction.Create, resource)),
    );
    expect(new Set(allowStates)).toEqual(new Set([true]));
  });

  it("includes exactly the five canonical write-controlled resources", () => {
    expect([...WRITE_CONTROLLED_RESOURCES].sort()).toEqual(
      [
        AccessResource.Campaign,
        AccessResource.PromoScenario,
        AccessResource.ProductMaster,
        AccessResource.CostConfiguration,
        AccessResource.PromoTemplate,
      ].sort(),
    );
  });

  it("allows SPV to read Approved promos and create Feedback_Record (Req 1.4)", () => {
    expect(
      isAllowed(authorize(SPV, AccessAction.Read, AccessResource.PromoScenario)),
    ).toBe(true);
    expect(
      isAllowed(
        authorize(SPV, AccessAction.Create, AccessResource.FeedbackRecord),
      ),
    ).toBe(true);
  });
});

describe("Admin_Marketplace — write denial on five resources (Req 1.6)", () => {
  it("denies create AND update on every one of the five controlled resources", () => {
    for (const resource of WRITE_CONTROLLED_RESOURCES) {
      for (const action of WRITE_ACTIONS) {
        const decision = authorize(ADMIN, action, resource);
        expect(decision.effect).toBe("Deny");
        expect(isAllowed(decision)).toBe(false);
      }
    }
  });

  it("returns a non-empty access-denied message naming the action and resource", () => {
    const decision = authorize(
      ADMIN,
      AccessAction.Create,
      AccessResource.Campaign,
    );
    expect(decision.effect).toBe("Deny");
    if (decision.effect === "Deny") {
      expect(decision.message.length).toBeGreaterThan(0);
      expect(decision.message).toContain("Akses ditolak");
      expect(decision.message).toContain(AccessAction.Create);
      expect(decision.message).toContain(AccessResource.Campaign);
    }
  });

  it("denies writes uniformly — no partial write access leaks through", () => {
    const denyStates = WRITE_CONTROLLED_RESOURCES.map(
      (resource) => !isAllowed(authorize(ADMIN, AccessAction.Update, resource)),
    );
    expect(new Set(denyStates)).toEqual(new Set([true]));
  });
});

describe("Admin_Marketplace — restricted allowed actions (Req 1.3, 1.5)", () => {
  it("allows reading Promo_Scenario (the Approved board)", () => {
    expect(
      isAllowed(
        authorize(ADMIN, AccessAction.Read, AccessResource.PromoScenario),
      ),
    ).toBe(true);
  });

  it("allows creating and reading Feedback_Record (implementation feedback)", () => {
    expect(
      isAllowed(
        authorize(ADMIN, AccessAction.Create, AccessResource.FeedbackRecord),
      ),
    ).toBe(true);
    expect(
      isAllowed(
        authorize(ADMIN, AccessAction.Read, AccessResource.FeedbackRecord),
      ),
    ).toBe(true);
  });

  it("denies updating Feedback_Record (only create/read are permitted)", () => {
    expect(
      isAllowed(
        authorize(ADMIN, AccessAction.Update, AccessResource.FeedbackRecord),
      ),
    ).toBe(false);
  });

  it("denies reading configuration resources outside the Admin interface", () => {
    // Admin's read access is limited to the promo board + feedback; reading the
    // configuration resources is not part of the simplified Admin interface.
    for (const resource of [
      AccessResource.ProductMaster,
      AccessResource.CostConfiguration,
      AccessResource.PromoTemplate,
      AccessResource.Campaign,
    ]) {
      expect(isAllowed(authorize(ADMIN, AccessAction.Read, resource))).toBe(
        false,
      );
    }
  });

  it("denies Admin every action on the SPV-only Brand resource", () => {
    for (const action of Object.values(AccessAction)) {
      expect(isAllowed(authorize(ADMIN, action, AccessResource.Brand))).toBe(
        false,
      );
    }
  });
});

describe("AccessController surface and helpers", () => {
  it("exposes authorize via the namespaced AccessController object", () => {
    expect(AccessController.authorize).toBe(authorize);
    expect(
      isAllowed(
        AccessController.authorize(
          SPV,
          AccessAction.Create,
          AccessResource.Campaign,
        ),
      ),
    ).toBe(true);
  });

  it("classifies write actions correctly", () => {
    expect(isWriteAction(AccessAction.Create)).toBe(true);
    expect(isWriteAction(AccessAction.Update)).toBe(true);
    expect(isWriteAction(AccessAction.Read)).toBe(false);
  });

  it("classifies the five write-controlled resources correctly", () => {
    for (const resource of WRITE_CONTROLLED_RESOURCES) {
      expect(isWriteControlledResource(resource)).toBe(true);
    }
    expect(isWriteControlledResource(AccessResource.FeedbackRecord)).toBe(false);
    expect(isWriteControlledResource(AccessResource.Brand)).toBe(false);
  });

  it("fails closed (deny) for an unrecognized role", () => {
    const rogue = { role: "Unknown_Role" as unknown as Role };
    const decision = authorize(rogue, AccessAction.Read, AccessResource.PromoScenario);
    expect(decision.effect).toBe("Deny");
    expect(isAllowed(decision)).toBe(false);
  });
});
