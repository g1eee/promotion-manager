/**
 * Brand archive Route Handler — `POST /api/brands/[id]/archive`
 * (Task 5.2, Req 19.7).
 *
 * Marks a Brand as archived without deleting its data — the non-destructive
 * alternative to DELETE that keeps historical records valid (Req 19.7). A write
 * gated by RBAC: SPV_Marketing allowed, Admin_Marketplace denied (Req 1.2, 1.6).
 * A missing Brand maps to 404 via {@link errorResponse}.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { getContainer } from "@/api/container";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(AccessAction.Update, AccessResource.Brand);
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { brandService } = await getContainer();
    const brand = await brandService.archive(id);
    return NextResponse.json(brand, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
