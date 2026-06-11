/**
 * Inline Campaign creation Route Handler.
 *
 * Creates a Campaign in the middle of Promo Scenario creation, defaulting the
 * Campaign Brand to the promo Brand and rejecting Brand mismatches.
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
import type { CreateInlineCampaignInput } from "@services/index";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asDate(value: unknown): Date {
  return typeof value === "string" || value instanceof Date
    ? new Date(value)
    : new Date(Number.NaN);
}

function toInlineInput(body: Record<string, unknown>): CreateInlineCampaignInput {
  const input: CreateInlineCampaignInput = {
    nama: asString(body.nama),
    tanggalMulai: asDate(body.tanggalMulai),
    tanggalSelesai: asDate(body.tanggalSelesai),
  };
  if (typeof body.brandId === "string") {
    input.brandId = body.brandId;
  }
  return input;
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
    const promoBrandId = asString(body.promoBrandId);
    const { campaignService } = await getContainer();
    const campaign = await campaignService.createInline(
      toInlineInput(body),
      promoBrandId,
      subject.userId,
    );
    return NextResponse.json({ ...campaign, promoCount: 0 }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
