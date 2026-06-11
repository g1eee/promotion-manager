/**
 * Campaign History Route Handler (Req 15).
 *
 * GET returns all campaigns with their promo counts (including zero-promo
 * campaigns, Req 15.3), filtered by the active Brand context and optional
 * Status / Date Range (Req 15.2). RBAC: read access to Campaign (Req 1.2).
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { getContainer } from "@/api/container";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { CampaignStatus } from "@domain/enums";

function parseStatus(value: string | null): CampaignStatus | undefined {
  if (value === null || value.trim() === "") return undefined;
  return (Object.values(CampaignStatus) as string[]).includes(value)
    ? (value as CampaignStatus)
    : undefined;
}

function parseDate(value: string | null): Date | undefined {
  if (value === null || value.trim() === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.Campaign,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const params = new URL(request.url).searchParams;

  try {
    const { campaignHistoryService } = await getContainer();
    const items = await campaignHistoryService.list({
      brand: params.get("brandId") ?? undefined,
      status: parseStatus(params.get("status")),
      dateFrom: parseDate(params.get("dateFrom")),
      dateTo: parseDate(params.get("dateTo")),
    });
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
