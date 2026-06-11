/**
 * Campaign item Route Handler.
 *
 * GET returns Campaign detail plus its Promo_Scenario list; PATCH edits
 * Campaign fields; DELETE permanently removes only campaigns with no promos.
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
import { CampaignStatus } from "@domain/enums";
import type { UpdateCampaignChanges } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function asDate(value: unknown): Date {
  return typeof value === "string" || value instanceof Date
    ? new Date(value)
    : new Date(Number.NaN);
}

function toUpdateChanges(body: Record<string, unknown>): UpdateCampaignChanges {
  const changes: UpdateCampaignChanges = {};
  if (typeof body.brandId === "string") changes.brandId = body.brandId;
  if (typeof body.nama === "string") changes.nama = body.nama;
  if (body.tanggalMulai !== undefined) {
    changes.tanggalMulai = asDate(body.tanggalMulai);
  }
  if (body.tanggalSelesai !== undefined) {
    changes.tanggalSelesai = asDate(body.tanggalSelesai);
  }
  if (body.status !== undefined) {
    changes.status = body.status as CampaignStatus;
  }
  return changes;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.Campaign,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { campaignService, promoService } = await getContainer();
    const campaign = await campaignService.get(id);
    const promos = await promoService.list({ campaignId: id });
    return NextResponse.json(
      { campaign: { ...campaign, promoCount: promos.length }, promos },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
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
    const { id } = await context.params;
    const { campaignService, promoService } = await getContainer();
    const campaign = await campaignService.update(id, toUpdateChanges(body));
    const promoCount = (await promoService.list({ campaignId: id })).length;
    return NextResponse.json({ ...campaign, promoCount }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
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
    const { campaignService } = await getContainer();
    await campaignService.delete(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
