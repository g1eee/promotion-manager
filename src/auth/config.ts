/**
 * NextAuth (Auth.js) configuration for the PMS authentication flow (Task 3.1).
 *
 * Responsibilities:
 *   - Provide a simple Credentials provider for the MVP, backed by the
 *     temporary in-memory seed users (`users.ts`). No DB/Prisma here — that is
 *     a later persistence task.
 *   - Plant the single domain {@link Role} into the JWT (`jwt` callback) and
 *     expose it on the session (`session` callback), so every authenticated
 *     account carries exactly one role (Req 1.1).
 *
 * Route guards and richer session state (active brand, etc.) are Task 3.2 and
 * are intentionally out of scope here.
 */

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findSeedUser } from "./users";

export const authConfig: NextAuthConfig = {
  // Honor the NEXTAUTH_* env vars (with AUTH_* fallback). `trustHost` lets the
  // app infer its own URL behind the App Router dev/prod server.
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,

  // Credentials-based auth must use the JWT session strategy.
  session: { strategy: "jwt" },

  // Custom sign-in page (Req 1.1 login flow).
  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Validate the submitted credentials against the seed user list. On
       * success, return a user object that includes the single `role`; on
       * failure, return `null` so NextAuth reports invalid credentials.
       */
      authorize: (credentials) => {
        const user = findSeedUser(credentials?.email, credentials?.password);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Plant the single role into the token at sign-in time. `user` is only
     * present on the initial sign-in; on subsequent calls the role is already
     * carried by the token.
     */
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },

    /**
     * Surface the role (and stable id) from the token onto the session so it is
     * readable wherever the session is consumed — exactly one role per account.
     */
    session: ({ session, token }) => {
      session.user.role = token.role;
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
