/**
 * Promo Scenario item Route Handler.
 *
 * GET returns one Promo_Scenario. PATCH edits Basic Information fields while
 * preserving invalid-state rollback in the service layer.
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
import { PromoType } from "@domain/enums";
import type { UpdatePromoChanges } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function asDate(value: unknown): Date {
  return typeof value === "string" || value instanceof Date
    ? new Date(value)
    : new Date(Number.NaN);
}

function toUpdateChanges(body: Record<string, unknown>): UpdatePromoChanges {
  const changes: UpdatePromoChanges = {};
  if (typeof body.brandId === "string") changes.brandId = body.brandId;
  if (typeof body.campaignId === "string") changes.campaignId = body.campaignId;
  if (typeof body.namaPromo === "string") changes.namaPromo = body.namaPromo;
  if (body.promoType !== undefined) changes.promoType = body.promoType as PromoType;
  if (body.tanggalMulai !== undefined) {
    changes.tanggalMulai = asDate(body.tanggalMulai);
  }
  if (body.tanggalSelesai !== undefined) {
    changes.tanggalSelesai = asDate(body.tanggalSelesai);
  }
  return changes;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.PromoScenario,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { promoService } = await getContainer();
    const promo = await promoService.get(id);
    return NextResponse.json(promo, { status: 200 });
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
    const { id } = await context.params;
    const { promoService } = await getContainer();
    const promo = await promoService.update(id, toUpdateChanges(body));
    return NextResponse.json(promo, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
