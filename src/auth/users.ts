/**
 * Seed / in-memory credential source (MVP ONLY).
 *
 * Task 3.1 wires up the authentication flow and associates every account with
 * exactly one role (Req 1.1). Persistence (Prisma/DB) is intentionally NOT set
 * up in this task — the design defers the `users` table to a later persistence
 * task. Until then, this module acts as a temporary, in-memory source of
 * credentials so the login flow can be exercised end-to-end.
 *
 * SECURITY NOTE: credentials here are plaintext seed values for local/MVP use
 * only. They are NOT a production authentication mechanism. When the `users`
 * table lands, replace `findSeedUser` with a repository lookup + password
 * hashing (e.g. bcrypt/argon2) without changing the auth callbacks.
 */

import { Role } from "@domain/enums";

/**
 * A single authenticatable account. Each account is bound to exactly one
 * {@link Role} (Req 1.1) — the role is a single scalar, never a list.
 */
export interface SeedUser {
  /** Stable unique identifier for the account. */
  id: string;
  /** Login identifier (used as the NextAuth credentials "email"). */
  email: string;
  /** Display name shown in the top app bar. */
  name: string;
  /** Plaintext password — MVP seed only (see security note above). */
  password: string;
  /** The single role associated with this account (exactly one). */
  role: Role;
}

/**
 * The temporary credential list: one SPV_Marketing and one Admin_Marketplace,
 * matching the two roles defined by the domain.
 */
export const seedUsers: readonly SeedUser[] = [
  {
    id: "user-spv",
    email: "spv@pms.local",
    name: "Andi (SPV Marketing)",
    password: "spv12345",
    role: Role.SPV_Marketing,
  },
  {
    id: "user-admin",
    email: "admin@pms.local",
    name: "Budi (Admin Marketplace)",
    password: "admin12345",
    role: Role.Admin_Marketplace,
  },
];

/**
 * Resolve a seed user by credentials.
 *
 * Returns the matching account when the email/password pair is valid, or
 * `null` otherwise. The lookup is case-insensitive on email and trims
 * surrounding whitespace so minor input differences do not block valid logins.
 *
 * @param email Raw email/login identifier from the credentials form.
 * @param password Raw password from the credentials form.
 */
export function findSeedUser(
  email: unknown,
  password: unknown,
): SeedUser | null {
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === "" || password === "") {
    return null;
  }

  const match = seedUsers.find(
    (user) => user.email.toLowerCase() === normalizedEmail,
  );

  if (!match || match.password !== password) {
    return null;
  }

  return match;
}
