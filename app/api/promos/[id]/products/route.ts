/**
 * Promo Scenario product-selection Route Handler.
 *
 * GET returns selected products plus selectable same-Brand Active candidates.
 * POST adds one or many Product IDs to the promo.
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

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? [value] : [];
}

export async function GET(
  request: Request,
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
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? undefined;
    const { promoService } = await getContainer();
    const selection = await promoService.productSelection(id, { keyword });
    return NextResponse.json(selection, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
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
    const promo = await promoService.addProductsById(
      id,
      asStringList(body.productIds),
    );
    return NextResponse.json(promo, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
