/**
 * Shared HTTP helpers for the API layer: RBAC gating and domain-error mapping.
 *
 * Centralizes two concerns every Route Handler needs:
 *   - {@link authorizeRequest} reads the authenticated session, enforces RBAC
 *     via {@link authorize} (the single source of truth, Req 1.6), and returns
 *     either the authorized subject or a ready-to-return error `Response`
 *     (401 unauthenticated, 403 access denied).
 *   - {@link errorResponse} maps domain/persistence errors to HTTP status codes
 *     per the design's Error Handling section: validation → 422,
 *     unique/referential constraint → 409, not found → 404, missing FK → 422,
 *     and anything unexpected → 500.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  AccessAction,
  AccessResource,
  authorize,
  isAllowed,
} from "@/auth";
import {
  ForeignKeyError,
  NotFoundError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "@persistence/errors";
import { ValidationError } from "@services/errors";

/** The authenticated subject of a request once RBAC has passed. */
export interface AuthorizedRequest {
  /** Stable account identifier (used as createdBy on writes). */
  readonly userId: string;
}

/**
 * Gate a request behind authentication + RBAC.
 *
 * @returns the {@link AuthorizedRequest} when allowed, or a `NextResponse`
 *   carrying a 401/403 error that the caller should return directly.
 */
export async function authorizeRequest(
  action: AccessAction,
  resource: AccessResource,
): Promise<AuthorizedRequest | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { errorType: "unauthenticated", message: "Sesi tidak ditemukan." },
      { status: 401 },
    );
  }

  const decision = authorize({ role: session.user.role }, action, resource);
  if (!isAllowed(decision)) {
    return NextResponse.json(
      {
        errorType: "access_denied",
        message:
          decision.effect === "Deny"
            ? decision.message
            : "Akses ditolak.",
      },
      { status: 403 },
    );
  }

  return { userId: session.user.id };
}

/**
 * True when `value` is a `NextResponse` (the deny/short-circuit case).
 *
 * Generic over the success payload so it narrows both
 * {@link authorizeRequest} (`AuthorizedRequest | NextResponse`) and
 * {@link parseJsonBody} (`Record<string, unknown> | NextResponse`) results.
 */
export function isResponse<T>(
  value: T | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * Parse a request's JSON body into a plain object.
 *
 * Returns the parsed object on success, or a 422 `validation` `NextResponse`
 * when the body is missing, malformed, or not a JSON object — mirroring the
 * shape produced by {@link errorResponse} for {@link ValidationError} so the
 * client sees a single, consistent validation contract.
 */
export async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errorType: "validation", message: "Body permintaan bukan JSON yang valid.", fields: {} },
      { status: 422 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { errorType: "validation", message: "Body permintaan harus berupa objek JSON.", fields: {} },
      { status: 422 },
    );
  }

  return body as Record<string, unknown>;
}

/** Map a thrown domain/persistence error to the appropriate HTTP response. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        errorType: "validation",
        message: error.message,
        fields: error.fields,
      },
      { status: 422 },
    );
  }

  if (
    error instanceof UniqueConstraintError ||
    error instanceof ReferentialIntegrityError
  ) {
    return NextResponse.json(
      { errorType: "constraint", message: error.message },
      { status: 409 },
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { errorType: "not_found", message: error.message },
      { status: 404 },
    );
  }

  if (error instanceof ForeignKeyError) {
    return NextResponse.json(
      { errorType: "validation", message: error.message },
      { status: 422 },
    );
  }

  // Unexpected/system error: do not leak internals.
  return NextResponse.json(
    {
      errorType: "system",
      message: "Terjadi kesalahan sistem yang tidak terduga.",
    },
    { status: 500 },
  );
}
