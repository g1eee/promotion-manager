"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@domain/enums";
import { cx } from "@ui/utils/cx";
import { navGroupsForRole } from "./nav-config";

export interface SidebarProps {
  /**
   * Active user role driving role-aware navigation visibility.
   *
   * Defaults to {@link Role.SPV_Marketing} (the full interface) so the shell
   * renders correctly before session wiring lands in Task 3.2. Full session
   * integration will pass the authenticated user's role here.
   */
  role?: Role;
}

/**
 * App shell sidebar (role-aware).
 *
 * Renders the module navigation for the active role using
 * `navGroupsForRole(role)` and highlights the active route based on the current
 * pathname. The active state matches an item when the pathname equals its href
 * or is nested beneath it (e.g. `/promo/campaigns/123` activates `Campaigns`).
 *
 * Role behaviour (Req 1.2 / 1.3 / 1.6):
 *   - SPV_Marketing: full interface (every item).
 *   - Admin_Marketplace: simplified interface with configuration modules
 *     (Master Data, Settings/Brand Management) and Campaign/Promo Scenario
 *     management hidden; Promo Execution + Feedback remain.
 *
 * Hiding items here is a convenience layer; the API remains the real access
 * enforcer (Req 1.6).
 */
export function Sidebar({ role = Role.SPV_Marketing }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const groups = navGroupsForRole(role);

  return (
    <nav className="pms-shell__sidebar" aria-label="Main navigation">
      <div className="pms-shell__brand">
        <span className="pms-shell__brand-mark">PMS</span>
        <span className="pms-shell__brand-name">Promotion Manager</span>
      </div>

      {groups.map((group, index) => (
        <div className="pms-nav-group" key={group.label ?? `group-${index}`}>
          {group.label && (
            <div className="pms-nav-group__label">{group.label}</div>
          )}
          <ul className="pms-nav-group__list">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(
                      "pms-nav-link",
                      active && "pms-nav-link--active",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
