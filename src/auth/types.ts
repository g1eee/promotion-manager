/**
 * NextAuth (Auth.js) type augmentation for the PMS.
 *
 * Embeds the single domain {@link Role} into both the session user and the JWT
 * so role can be read consistently on the server and client. This is the type
 * counterpart of the `jwt`/`session` callbacks in `config.ts`, which plant the
 * role into the token and session at runtime (Req 1.1 — exactly one role per
 * account).
 */

import type { Role } from "@domain/enums";
import type { DefaultSession } from "next-auth";
// Side-effect import so the `next-auth/jwt` module is part of the program and
// can be augmented below (bundler resolution requires the reference).
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * The authenticated user. `role` is required and always present once a user
   * is signed in, reflecting the "exactly one role per account" invariant.
   */
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      /** Stable account identifier (mirrors the JWT subject). */
      id: string;
      /** The single role associated with the signed-in account. */
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** The single role planted into the token by the `jwt` callback. */
    role: Role;
  }
}
