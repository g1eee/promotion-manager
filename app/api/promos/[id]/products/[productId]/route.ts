/**
 * Promo Scenario selected-product item Route Handler.
 *
 * DELETE removes one selected ProductRef by Product ID.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { getContainer } from "@/api/container";

interface RouteContext {
  readonly params: Promise<{ id: string; productId: string }>;
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.PromoScenario,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id, productId } = await context.params;
    const { promoService } = await getContainer();
    const promo = await promoService.removeProduct(
      id,
      decodeURIComponent(productId),
    );
    return NextResponse.json(promo, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
