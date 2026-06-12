/**
 * Approval History Route Handler (Req 17.1).
 *
 * GET returns the governance/audit listing of promo approval status changes
 * (Nama Promo, Campaign, Tanggal Approval, Status Approval), newest-first and
 * scoped to the active Brand from the Global Brand Selector when `brandId` is
 * supplied. RBAC: read access to Promo_Scenario (Req 1.2).
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { getContainer } from "@/api/container";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";

function parseDate(value: string | null): Date | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

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
  const dateFrom = parseDate(url.searchParams.get("dateFrom"));
  const dateTo = parseDate(url.searchParams.get("dateTo"));

  try {
    const { approvalHistoryService } = await getContainer();
    const items = await approvalHistoryService.list({ brand: brandId, dateFrom, dateTo });
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
