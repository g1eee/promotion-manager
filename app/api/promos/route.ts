/**
 * Promo Scenario collection Route Handler.
 *
 * GET lists promos by optional Brand/Campaign/Status filters. POST creates a
 * Draft Promo_Scenario, optionally with an inline Campaign.
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
import { PromoStatus, PromoType } from "@domain/enums";
import type {
  CreateInlineCampaignInput,
  CreatePromoInput,
  CreatePromoWithInlineCampaignInput,
} from "@services/index";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asDate(value: unknown): Date {
  return typeof value === "string" || value instanceof Date
    ? new Date(value)
    : new Date(Number.NaN);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toCreateInput(body: Record<string, unknown>): CreatePromoInput {
  return {
    brandId: asString(body.brandId),
    campaignId: asString(body.campaignId),
    namaPromo: asString(body.namaPromo),
    promoType: body.promoType as PromoType,
    tanggalMulai: asDate(body.tanggalMulai),
    tanggalSelesai: asDate(body.tanggalSelesai),
  };
}

function toCreateInlinePromoInput(
  body: Record<string, unknown>,
): CreatePromoWithInlineCampaignInput {
  return {
    brandId: asString(body.brandId),
    namaPromo: asString(body.namaPromo),
    promoType: body.promoType as PromoType,
    tanggalMulai: asDate(body.tanggalMulai),
    tanggalSelesai: asDate(body.tanggalSelesai),
  };
}

function toInlineCampaignInput(
  body: Record<string, unknown>,
): CreateInlineCampaignInput {
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
  const campaignId = url.searchParams.get("campaignId") ?? undefined;
  const status = url.searchParams.get("status") as PromoStatus | null;

  try {
    const { promoService } = await getContainer();
    const promos = await promoService.list({
      brandId,
      campaignId,
      status: status ?? undefined,
    });
    return NextResponse.json(promos, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
    AccessResource.PromoScenario,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { promoService } = await getContainer();
    const inlineCampaign = asRecord(body.inlineCampaign);
    const promo = inlineCampaign
      ? await promoService.createWithInlineCampaign(
          toCreateInlinePromoInput(body),
          toInlineCampaignInput(inlineCampaign),
          subject.userId,
        )
      : await promoService.create(toCreateInput(body), subject.userId);
    return NextResponse.json(promo, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
