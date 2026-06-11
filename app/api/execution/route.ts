/**
 * Promo Execution board Route Handler.
 *
 * GET returns Approved-only promos for the Admin Marketplace execution board,
 * optionally scoped by the active Brand.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { getContainer } from "@/api/container";

export async function GET(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.ExecutionStatus,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId") ?? undefined;

  try {
    const { adminExecutionBoard } = await getContainer();
    const rows = await adminExecutionBoard.list({ brandId });
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
