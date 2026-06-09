"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, Field, Input } from "@/ui";

export interface LoginFormProps {
  /** Where to navigate after a successful sign-in. */
  callbackUrl: string;
}

/**
 * Credentials login form for the PMS.
 *
 * Submits email/password to the NextAuth Credentials provider. On success the
 * server plants the account's single role into the session/JWT (see
 * `src/auth/config.ts`) and the user is routed to `callbackUrl`. On failure an
 * inline error is shown without leaving the page.
 */
export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Email atau password salah. Silakan coba lagi.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Terjadi kendala saat masuk. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padding="lg" className="pms-login__card">
      <div className="pms-login__header">
        <span className="pms-login__brand-mark">PMS</span>
        <h1 className="pms-login__title">Masuk ke Promotion Manager</h1>
        <p className="pms-login__subtitle">
          Gunakan akun Anda untuk melanjutkan.
        </p>
      </div>

      <form className="pms-login__form" onSubmit={handleSubmit} noValidate>
        <Field htmlFor="login-email" label="Email" required>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={error != null}
            required
          />
        </Field>

        <Field htmlFor="login-password" label="Password" required>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={error != null}
            required
          />
        </Field>

        {error && (
          <p className="pms-login__error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" block size="lg" disabled={submitting}>
          {submitting ? "Memproses…" : "Masuk"}
        </Button>
      </form>
    </Card>
  );
}
