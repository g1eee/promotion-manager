import type { ReactNode } from "react";
import { LineChart } from "lucide-react";
import { Role } from "@domain/enums";

/**
 * App shell top bar.
 *
 * Renders the persistent top app bar that stays consistent across every module
 * route, as described in design.md ("UX & Screen Design" → top app bar
 * wireframe: `PMS  [ Brand: ... v ]  <Peran> (<Nama>)`). It surfaces these
 * regions:
 *   - PMS brand/logo (left).
 *   - Global Brand Selector container (left) — a reserved slot filled by the
 *     active-brand selector (Task 2.5).
 *   - User identity + role (right) — Req 1.1: every account is associated with
 *     exactly one role (SPV_Marketing or Admin_Marketplace).
 *   - Sign-out control (right) — optional slot filled by the layout (Task 3.2).
 *
 * User identity and role are accepted as props with placeholder defaults. The
 * app shell layout derives them from the authenticated session (Task 3.2) and
 * passes them in; the defaults only keep the shell renderable in isolation.
 */

/** Human-readable label for each role (Req 1.1: exactly one role per account). */
const ROLE_LABELS: Record<Role, string> = {
  [Role.SPV_Marketing]: "SPV Marketing",
  [Role.Admin_Marketplace]: "Admin Marketplace",
};

export interface TopBarProps {
  /**
   * Display name of the signed-in user. Placeholder default until session
   * integration supplies it (Task 3.2).
   */
  userName?: string;
  /**
   * The single domain {@link Role} of the signed-in user. Drives the role label
   * shown next to the identity. Placeholder default keeps the shell renderable
   * before the session is wired in.
   */
  userRole?: Role;
  /**
   * Content rendered inside the Global Brand Selector container. Supplied by
   * Task 2.5; when omitted an inert placeholder is rendered so the layout
   * reserves space and the wiring point exists.
   */
  brandSelectorSlot?: ReactNode;
  /**
   * Optional sign-out control rendered on the right (Task 3.2). The layout
   * injects a client-side button here so this component can stay server-side.
   */
  signOutSlot?: ReactNode;
  /**
   * Optional notifications control (Work Queue indicator) rendered on the
   * right. Injected by the layout as a client component.
   */
  notificationSlot?: ReactNode;
}

/** First letters of up to two name parts, used for the identity avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function TopBar({
  userName = "Pengguna",
  userRole = Role.SPV_Marketing,
  brandSelectorSlot,
  signOutSlot,
  notificationSlot,
}: TopBarProps = {}) {
  const roleLabel = ROLE_LABELS[userRole];

  return (
    <header className="pms-shell__topbar" role="banner">
      <div className="pms-shell__topbar-left">
        <div className="pms-shell__topbar-brand">
          <span className="pms-shell__topbar-brand-mark" aria-hidden="true">
            <LineChart size={16} />
          </span>
          <span className="pms-shell__topbar-brand-name">
            Campaign Tracker
          </span>
        </div>

        {/* Container: Global Brand Selector (full selector logic in Task 2.5). */}
        <div
          className="pms-shell__slot pms-shell__slot--brand"
          data-slot="global-brand-selector"
        >
          {brandSelectorSlot ?? (
            <span className="pms-shell__slot-placeholder" aria-hidden="true">
              Brand: —
            </span>
          )}
        </div>
      </div>

      <div className="pms-shell__topbar-right">
        {notificationSlot && (
          <div className="pms-shell__slot" data-slot="notifications">
            {notificationSlot}
          </div>
        )}

        {/* User identity + role (Req 1.1). */}
        <div
          className="pms-shell__user"
          data-slot="user-identity"
          aria-label={`Pengguna ${userName}, peran ${roleLabel}`}
        >
          <span className="pms-shell__avatar" aria-hidden="true">
            {initialsOf(userName)}
          </span>
          <span className="pms-shell__user-text">
            <span className="pms-shell__user-role">{roleLabel}</span>
            <span className="pms-shell__user-name">{userName}</span>
          </span>
        </div>

        {/* Optional sign-out control (Task 3.2). */}
        {signOutSlot && (
          <div className="pms-shell__slot" data-slot="sign-out">
            {signOutSlot}
          </div>
        )}
      </div>
    </header>
  );
}
