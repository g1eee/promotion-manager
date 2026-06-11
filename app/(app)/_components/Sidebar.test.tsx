// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { Role } from "@domain/enums";
import {
  allNavItems,
  isNavItemVisible,
  navGroupsForRole,
} from "./nav-config";
import { Sidebar } from "./Sidebar";

/**
 * Unit tests for role-based sidebar visibility (App Shell navigation).
 *
 * SPV_Marketing sees the full interface; Admin_Marketplace sees a simplified
 * interface with configuration modules (Master Data, Settings/Brand Management)
 * and Campaign/Promo Scenario management hidden, landing on Promo Execution.
 *
 * Validates: Requirements 1.2, 1.3
 */

// Sidebar renders next/link + reads the current pathname; stub both so the
// component renders in isolation under jsdom.
vi.mock("next/navigation", () => ({
  usePathname: () => "/promo/execution",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Labels that only SPV_Marketing may see (hidden in the Admin interface). */
const SPV_ONLY_LABELS = [
  "Campaigns",
  "Promos",
  "Products",
  "Costs",
  "Templates",
  "Brand Management",
];

/** Labels visible to every role. */
const SHARED_LABELS = [
  "Home",
  "Timeline",
  "Execution",
  "Campaign History",
  "Promo History",
  "Approval History",
];

afterEach(() => {
  cleanup();
});

describe("nav-config role visibility", () => {
  it("shows every navigable item to SPV_Marketing", () => {
    const visibleHrefs = navGroupsForRole(Role.SPV_Marketing)
      .flatMap((group) => group.items)
      .map((item) => item.href);

    expect(visibleHrefs).toEqual(allNavItems.map((item) => item.href));
  });

  it("hides configuration and authoring modules from Admin_Marketplace", () => {
    const adminLabels = navGroupsForRole(Role.Admin_Marketplace)
      .flatMap((group) => group.items)
      .map((item) => item.label);

    for (const hidden of SPV_ONLY_LABELS) {
      expect(adminLabels).not.toContain(hidden);
    }
    expect(adminLabels).toContain("Execution");
    expect(adminLabels).toContain("Home");
  });

  it("drops groups left empty after filtering for Admin_Marketplace", () => {
    const adminGroupLabels = navGroupsForRole(Role.Admin_Marketplace).map(
      (group) => group.label,
    );

    // Master Data + Settings groups collapse entirely for Admin.
    expect(adminGroupLabels).not.toContain("Master Data");
    expect(adminGroupLabels).not.toContain("Settings");
  });

  it("isNavItemVisible treats role-less items as visible to every role", () => {
    const sharedItem = { label: "Home", href: "/dashboard" };
    const restrictedItem = {
      label: "Brand Management",
      href: "/settings/brand-management",
      roles: [Role.SPV_Marketing],
    };

    expect(isNavItemVisible(sharedItem, Role.Admin_Marketplace)).toBe(true);
    expect(isNavItemVisible(restrictedItem, Role.Admin_Marketplace)).toBe(false);
    expect(isNavItemVisible(restrictedItem, Role.SPV_Marketing)).toBe(true);
  });
});

describe("Sidebar rendering", () => {
  it("renders the full interface for SPV_Marketing", () => {
    render(<Sidebar role={Role.SPV_Marketing} />);

    for (const label of [...SHARED_LABELS, ...SPV_ONLY_LABELS]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders the simplified interface for Admin_Marketplace", () => {
    render(<Sidebar role={Role.Admin_Marketplace} />);

    for (const label of SHARED_LABELS) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    for (const hidden of SPV_ONLY_LABELS) {
      expect(
        screen.queryByRole("link", { name: hidden }),
      ).not.toBeInTheDocument();
    }
  });

  it("defaults to the full SPV_Marketing interface when no role is given", () => {
    render(<Sidebar />);

    expect(
      screen.getByRole("link", { name: "Brand Management" }),
    ).toBeInTheDocument();
  });

  it("marks the active route based on the current pathname", () => {
    render(<Sidebar role={Role.SPV_Marketing} />);

    const activeLink = screen.getByRole("link", { name: "Execution" });
    expect(activeLink).toHaveAttribute("aria-current", "page");

    const inactiveLink = screen.getByRole("link", { name: "Home" });
    expect(inactiveLink).not.toHaveAttribute("aria-current");
  });
});
