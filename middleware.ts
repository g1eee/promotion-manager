/**
 * Next.js middleware — session presence + role-based UI route guard (Task 3.2).
 *
 * Runs on every app route (see `config.matcher`) and provides two convenience
 * guards before a page renders:
 *   1. Authentication gate — visitors without a session are redirected to
 *      `/login` with a `callbackUrl` so they return to where they were headed.
 *   2. Role-based UI guard — Admin_Marketplace is redirected away from
 *      configuration modules (Master Data, Settings/Brand Management, and
 *      Campaign/Promo Scenario management) to their landing page,
 *      `/promo/execution`.
 *
 * CONVENIENCE LAYER ONLY (Req 1.6). This middleware improves UX by keeping users
 * out of screens they cannot use, but it is NOT the real access enforcer. The
 * API layer (RBAC) remains the single source of truth and must re-check every
 * mutating request — a redirect here can be bypassed and must never be relied
 * upon for security.
 *
 * The matcher excludes auth API routes, Next.js internals/static assets, and
 * the `/login` page itself (to avoid a redirect loop when unauthenticated).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ADMIN_FALLBACK_PATH, isUiAccessAllowed } from "@/auth/route-guards";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;

  // 1) Authentication gate — no session means send the user to sign in,
  //    preserving the intended destination as `callbackUrl`.
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${nextUrl.pathname}${nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  // 2) Role-based UI guard — redirect Admin_Marketplace away from SPV-only
  //    configuration modules to their landing page. (Primary enforcement still
  //    lives in the API per Req 1.6.)
  if (!isUiAccessAllowed(session.user.role, nextUrl.pathname)) {
    return NextResponse.redirect(new URL(ADMIN_FALLBACK_PATH, nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  /**
   * Apply to everything except:
   *   - `/api/*`        — API routes (incl. NextAuth at `/api/auth/*`).
   *   - `/_next/static` — build assets.
   *   - `/_next/image`  — optimized images.
   *   - `favicon.ico`   — site icon.
   *   - `/login`        — the sign-in page (prevents an auth-redirect loop).
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
