/**
 * Promo Simulator Route Handler.
 *
 * POST computes the inline simulator payload for one Promo_Scenario: active
 * Cost Configuration metadata, Summary View counts, and Detailed View rows.
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
import type { SimulatePromoInput } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function toSimulateInput(body: Record<string, unknown>): SimulatePromoInput {
  return {
    ruleId: typeof body.ruleId === "string" ? body.ruleId : null,
  };
}

export async function POST(
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

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { id } = await context.params;
    const { promoSimulatorService } = await getContainer();
    const simulation = await promoSimulatorService.simulate(
      id,
      toSimulateInput(body),
    );
    return NextResponse.json(simulation, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
