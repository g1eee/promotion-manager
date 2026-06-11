/**
 * Promo Scenario bulk product-selection Route Handler.
 *
 * POST bulk-pastes Product IDs, persists added refs, and returns partition
 * feedback for added/skipped/unmatched IDs.
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

function parseProductIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,;\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
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
    const result = await promoService.bulkAddProductsById(
      id,
      parseProductIds(body.productIds),
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
