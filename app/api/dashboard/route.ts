/**
 * Dashboard summary Route Handler.
 *
 * GET returns widgets, Work Queue, and Recent Activity recomputed from the
 * latest data, optionally scoped by the active Brand from the global selector.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { getContainer } from "@/api/container";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";

export async function GET(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.PromoScenario,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam === null ? undefined : Number(limitParam);

  try {
    const { dashboardService } = await getContainer();
    const summary = await dashboardService.summary({
      brandId,
      userId: subject.userId,
      limit,
    });
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
