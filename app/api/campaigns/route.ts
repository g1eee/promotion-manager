/**
 * Campaign collection Route Handler.
 *
 * GET lists Campaigns with optional Brand filter and includes `promoCount`.
 * POST creates a Campaign with initial Draft status after RBAC validation.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import {
  authorizeRequest,
  errorResponse,
  isResponse,
  parseJsonBody,
} from "@/api/http";
import { getContainer } from "@/api/container";
import type { CreateCampaignInput } from "@services/index";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asDate(value: unknown): Date {
  return typeof value === "string" || value instanceof Date
    ? new Date(value)
    : new Date(Number.NaN);
}

function toCreateInput(body: Record<string, unknown>): CreateCampaignInput {
  return {
    brandId: asString(body.brandId),
    nama: asString(body.nama),
    tanggalMulai: asDate(body.tanggalMulai),
    tanggalSelesai: asDate(body.tanggalSelesai),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.Campaign,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId") ?? undefined;

  try {
    const { campaignService, promoService } = await getContainer();
    const campaigns = await campaignService.list({ brandId });
    const withCounts = await Promise.all(
      campaigns.map(async (campaign) => ({
        ...campaign,
        promoCount: (await promoService.list({ campaignId: campaign.id }))
          .length,
      })),
    );
    return NextResponse.json(withCounts, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
    AccessResource.Campaign,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { campaignService } = await getContainer();
    const campaign = await campaignService.create(
      toCreateInput(body),
      subject.userId,
    );
    return NextResponse.json({ ...campaign, promoCount: 0 }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
