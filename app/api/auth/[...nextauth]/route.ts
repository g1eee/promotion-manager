/**
 * NextAuth (Auth.js) catch-all route handler for the App Router.
 *
 * Exposes the GET/POST endpoints under `/api/auth/*` (sign-in, callback,
 * session, csrf, signout) by re-exporting the `handlers` produced by the
 * NextAuth instance in `src/auth`.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
