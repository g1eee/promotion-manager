/**
 * Campaign archive Route Handler.
 *
 * Marks a Campaign Archived without deleting it, preserving campaign history
 * and promo containment for reporting/audit.
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
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.Campaign,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { campaignService, promoService } = await getContainer();
    const campaign = await campaignService.archive(id);
    const promoCount = (await promoService.list({ campaignId: id })).length;
    return NextResponse.json({ ...campaign, promoCount }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
