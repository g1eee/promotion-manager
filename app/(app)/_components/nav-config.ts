/**
 * Navigation configuration for the PMS app shell.
 *
 * This is the single source of truth for the sidebar structure and the routes
 * exposed by the application. It mirrors the "Page Hierarchy / Navigation"
 * section of design.md:
 *   - Dashboard
 *   - Promo Management: Campaigns / Promo Scenarios / Promo Execution
 *   - Master Data: Product Master / Cost Configuration / Promo Templates
 *   - Reports: Campaign History / Promo History / Approval History
 *   - Settings: Brand Management
 *
 * Role-aware visibility (Task 2.3, Req 1.2 / 1.3 / 1.6)
 * ----------------------------------------------------
 * design.md → "Navigasi berbasis peran (role-aware navigation)":
 *   - SPV_Marketing sees the FULL interface (every item).
 *   - Admin_Marketplace sees a SIMPLIFIED interface. The following are hidden:
 *       • Master Data (Product Master, Cost Configuration, Promo Templates)
 *       • Settings (Brand Management)
 *       • Campaign + Promo Scenario creation/management (Campaigns, Promo Scenarios)
 *     Admin lands directly on Promo Execution (Approved promos needing action)
 *     and the Feedback thread.
 *
 * UI hiding here is a convenience layer only; the API layer remains the real
 * access enforcer (Req 1.6). Each `NavItem` declares the roles permitted to see
 * it; an item with no `roles` is visible to every role.
 */

import { Role } from "@domain/enums";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Megaphone,
  Tag,
  Rocket,
  CalendarClock,
  Package,
  History,
  ClipboardCheck,
  Building2,
  User,
} from "lucide-react";

export interface NavItem {
  /** Visible label in the sidebar. */
  label: string;
  /** Absolute route path handled by the App Router. */
  href: string;
  /** Icon rendered beside the label (lucide). */
  icon?: LucideIcon;
  /**
   * Roles allowed to see this item. When omitted, the item is visible to every
   * role (e.g. Home). Restricting an item to `[Role.SPV_Marketing]` hides
   * it from the simplified Admin_Marketplace interface.
   */
  roles?: Role[];
}

export interface NavGroup {
  /** Optional group heading. Single-item groups (e.g. Home) omit it. */
  label?: string;
  /** Items belonging to this group. */
  items: NavItem[];
}

/** Items only SPV_Marketing may see (hidden in the simplified Admin interface). */
const SPV_ONLY: Role[] = [Role.SPV_Marketing];

export const navGroups: NavGroup[] = [
  {
    items: [{ label: "Home", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Promotions",
    items: [
      { label: "Campaigns", href: "/promo/campaigns", icon: Megaphone, roles: SPV_ONLY },
      { label: "Promos", href: "/promo/scenarios", icon: Tag, roles: SPV_ONLY },
      { label: "Timeline", href: "/promo/timeline", icon: CalendarClock },
      { label: "Execution", href: "/promo/execution", icon: Rocket },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Products", href: "/master/products", icon: Package, roles: SPV_ONLY },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "History", href: "/reports/history", icon: History },
      { label: "Approval History", href: "/reports/approval-history", icon: ClipboardCheck },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Brand Management",
        href: "/settings/brand-management",
        icon: Building2,
        roles: SPV_ONLY,
      },
      {
        label: "Account Settings",
        href: "/settings/account",
        icon: User,
        roles: SPV_ONLY,
      },
    ],
  },
];

/** Returns true when `item` is visible to `role`. */
export function isNavItemVisible(item: NavItem, role: Role): boolean {
  return item.roles === undefined || item.roles.includes(role);
}

/**
 * Builds the navigation groups visible to a given role.
 *
 * Items the role cannot see are removed, and any group left without visible
 * items is dropped entirely so the sidebar never renders an empty heading.
 */
export function navGroupsForRole(role: Role): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list of every navigable route, useful for tests and guards. */
export const allNavItems: NavItem[] = navGroups.flatMap((group) => group.items);
