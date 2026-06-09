import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk — Promotion Management System",
};

/**
 * Login page (Req 1.1 login flow).
 *
 * Renders the credentials form outside the authenticated app shell. The
 * optional `callbackUrl` query param (set by NextAuth/route guards) determines
 * where the user lands after a successful sign-in; it defaults to the
 * dashboard.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const raw = params.callbackUrl;
  const callbackUrl =
    (Array.isArray(raw) ? raw[0] : raw)?.trim() || "/dashboard";

  return (
    <main className="pms-login">
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
