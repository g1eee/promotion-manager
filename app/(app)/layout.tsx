import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandProvider } from "./_components/BrandContext";
import { GlobalBrandSelector } from "./_components/GlobalBrandSelector";
import { SignOutButton } from "./_components/SignOutButton";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";

/**
 * Application shell layout (Task 3.2 — Session Management).
 *
 * Wraps every module route in the `(app)` route group with the persistent
 * top app bar + sidebar + content area defined in design.md
 * ("UX & Screen Design" → "Page Hierarchy / Navigation").
 *
 * Session integration:
 *   - Reads the authenticated session on the server via {@link auth}. With no
 *     session the user is redirected to `/login`. This mirrors the middleware
 *     auth gate and keeps the shell from rendering for signed-out users even if
 *     the middleware is bypassed.
 *   - Derives the signed-in user's display name and single {@link Role} from the
 *     session (Req 1.1 — exactly one role per account) and passes them to the
 *     {@link TopBar} (identity + role) and {@link Sidebar} (role-aware nav).
 *
 * Role-based UI access (Req 1.2 / 1.3 / 1.6) is enforced as a convenience layer
 * by the middleware route guard (configuration modules redirect
 * Admin_Marketplace) and reflected in the role-aware sidebar. The API layer
 * remains the primary access enforcer (Req 1.6).
 *
 * The {@link BrandProvider} supplies the active-Brand session context (sticky
 * per session via `sessionStorage`) consumed by feature-phase modules, and the
 * {@link GlobalBrandSelector} is injected into the top app bar's
 * `brandSelectorSlot` (Task 2.5).
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await auth();

  // Auth gate: no session → sign in. (Middleware also guards this; this is a
  // defensive server-side check so the shell never renders signed-out.)
  if (!session?.user) {
    redirect("/login");
  }

  const userName = session.user.name ?? "Pengguna";
  const userRole = session.user.role;

  return (
    <BrandProvider>
      <div className="pms-shell">
        <TopBar
          userName={userName}
          userRole={userRole}
          brandSelectorSlot={<GlobalBrandSelector />}
          signOutSlot={<SignOutButton />}
        />
        <Sidebar role={userRole} />
        <main className="pms-shell__content" id="main-content">
          {children}
        </main>
      </div>
    </BrandProvider>
  );
}
