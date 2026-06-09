import { describe, it, expect } from "vitest";
import { Role } from "@domain/enums";
import {
  navGroups,
  navGroupsForRole,
  isNavItemVisible,
  allNavItems,
  type NavItem,
} from "../../app/(app)/_components/nav-config";

/** Flatten the groups returned for a role into a label set for assertions. */
function labelsFor(role: Role): Set<string> {
  return new Set(
    navGroupsForRole(role).flatMap((group) =>
      group.items.map((item) => item.label),
    ),
  );
}

/** Hrefs hidden from the simplified Admin_Marketplace interface. */
const ADMIN_HIDDEN_HREFS = [
  "/promo/campaigns",
  "/promo/scenarios",
  "/master/products",
  "/master/cost-configuration",
  "/master/templates",
  "/settings/brand-management",
];

describe("nav-config role-aware navigation", () => {
  describe("isNavItemVisible", () => {
    it("treats items without a roles list as visible to every role", () => {
      const item: NavItem = { label: "Anything", href: "/x" };
      expect(isNavItemVisible(item, Role.SPV_Marketing)).toBe(true);
      expect(isNavItemVisible(item, Role.Admin_Marketplace)).toBe(true);
    });

    it("restricts items to the roles listed", () => {
      const item: NavItem = {
        label: "SPV only",
        href: "/y",
        roles: [Role.SPV_Marketing],
      };
      expect(isNavItemVisible(item, Role.SPV_Marketing)).toBe(true);
      expect(isNavItemVisible(item, Role.Admin_Marketplace)).toBe(false);
    });
  });

  describe("SPV_Marketing (full interface, Req 1.2)", () => {
    it("sees every navigable item", () => {
      const visible = labelsFor(Role.SPV_Marketing);
      for (const item of allNavItems) {
        expect(visible.has(item.label)).toBe(true);
      }
    });

    it("preserves all configured groups", () => {
      expect(navGroupsForRole(Role.SPV_Marketing)).toHaveLength(
        navGroups.length,
      );
    });
  });

  describe("Admin_Marketplace (simplified interface, Req 1.3 / 1.6)", () => {
    const adminGroups = navGroupsForRole(Role.Admin_Marketplace);
    const adminHrefs = new Set(
      adminGroups.flatMap((group) => group.items.map((item) => item.href)),
    );

    it("hides configuration modules and Campaign/Promo Scenario management", () => {
      for (const href of ADMIN_HIDDEN_HREFS) {
        expect(adminHrefs.has(href)).toBe(false);
      }
    });

    it("keeps Dashboard and Promo Execution available", () => {
      expect(adminHrefs.has("/dashboard")).toBe(true);
      expect(adminHrefs.has("/promo/execution")).toBe(true);
    });

    it("drops the Master Data and Settings groups entirely (no empty headings)", () => {
      const groupLabels = adminGroups.map((group) => group.label);
      expect(groupLabels).not.toContain("Master Data");
      expect(groupLabels).not.toContain("Settings");
    });

    it("never renders a group without visible items", () => {
      for (const group of adminGroups) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });
});
