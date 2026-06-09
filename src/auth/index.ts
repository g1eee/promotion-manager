/**
 * Auth.js (NextAuth v5) instance for the PMS.
 *
 * Initializes NextAuth with the PMS {@link authConfig} and re-exports the
 * primitives the rest of the app consumes:
 *   - `handlers` — GET/POST route handlers for `app/api/auth/[...nextauth]`.
 *   - `auth`     — server-side session reader (used by Task 3.2 guards/UI).
 *   - `signIn` / `signOut` — server actions for the login flow.
 *
 * Importing this module also applies the session/JWT type augmentation in
 * `types.ts`, so the planted `role` is typed wherever auth is used.
 */

import NextAuth from "next-auth";
import { authConfig } from "./config";
import "./types";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { authConfig } from "./config";
export { seedUsers, findSeedUser } from "./users";
export type { SeedUser } from "./users";
export {
  SPV_ONLY_PATH_PREFIXES,
  ADMIN_FALLBACK_PATH,
  isSpvOnlyPath,
  isUiAccessAllowed,
} from "./route-guards";
export {
  AccessController,
  authorize,
  AccessAction,
  AccessResource,
  WRITE_CONTROLLED_RESOURCES,
  Allow,
  Deny,
  isAllowed,
  isWriteAction,
  isWriteControlledResource,
} from "./access-controller";
export type {
  AuthorizationSubject,
  AuthorizationDecision,
} from "./access-controller";
