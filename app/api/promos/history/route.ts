/**
 * Promo History Route Handler (Req 16).
 *
 * GET returns the cross-campaign promo history. Query parameters drive search
 * and the AND-combined filters (Req 16.2–16.5):
 *   - `keyword`    — substring match on Nama Promo
 *   - `brandId`    — active Brand context / Brand filter (Global Brand Selector)
 *   - `campaignId` — Campaign filter
 *   - `promoType`  — Promo_Type filter
 *   - `status`     — Status filter
 *   - `dateFrom` / `dateTo` — inclusive Tanggal Dibuat range (ISO date)
 *
 * With no parameters it lists all historical promos (also the Reset Filters
 * behaviour, Req 16.7). RBAC: read access to Promo_Scenario (Req 1.2).
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { getContainer } from "@/api/container";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { PromoStatus, PromoType } from "@domain/enums";
import type { PromoHistorySearch } from "@services/promo-history-service";

function parseEnum<T extends Record<string, string>>(
  enumObject: T,
  value: string | null,
): T[keyof T] | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const values = Object.values(enumObject) as string[];
  return values.includes(value) ? (value as T[keyof T]) : undefined;
}

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
  const params = url.searchParams;

  const search: PromoHistorySearch = {
    keyword: params.get("keyword") ?? undefined,
    brand: params.get("brandId") ?? undefined,
    campaign: params.get("campaignId") ?? undefined,
    promoType: parseEnum(PromoType, params.get("promoType")),
    status: parseEnum(PromoStatus, params.get("status")),
    dateFrom: parseDate(params.get("dateFrom")),
    dateTo: parseDate(params.get("dateTo")),
  };

  try {
    const { promoHistoryService } = await getContainer();
    const items = await promoHistoryService.search(search);
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
