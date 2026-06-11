/**
 * Promo Scenario clone Route Handler.
 *
 * POST creates a fresh Draft copy of an existing promo after SPV-only RBAC.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import {
  authorizeRequest,
  errorResponse,
  isResponse,
} from "@/api/http";
import { getContainer } from "@/api/container";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
    AccessResource.PromoScenario,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { promoCloneService } = await getContainer();
    const promo = await promoCloneService.clone(id, subject.userId);
    return NextResponse.json(promo, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
