import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk — Campaign Tracker",
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
      <aside className="pms-login__aside">
        <div className="pms-login__aside-brand">
          <span className="pms-login__aside-mark">CT</span>
          <span>Campaign Tracker</span>
        </div>
        <div>
          <h2 className="pms-login__aside-headline">
            Jalankan promo tanpa spreadsheet.
          </h2>
          <p className="pms-login__aside-sub">
            Rencanakan campaign, simulasikan margin, setujui, dan eksekusi —
            semua dalam satu konsol untuk seluruh brand Anda.
          </p>
          <div className="pms-login__aside-flow">
            <span className="pms-login__aside-step">Rencana</span>
            <span className="pms-login__aside-step">Simulasi</span>
            <span className="pms-login__aside-step">Approval</span>
            <span className="pms-login__aside-step">Eksekusi</span>
          </div>
        </div>
        <p className="pms-login__aside-sub">Campaign Tracker by Gie</p>
      </aside>
      <div className="pms-login__panel">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
