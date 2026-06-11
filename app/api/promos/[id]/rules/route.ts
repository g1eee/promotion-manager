/**
 * Promo Scenario rules Route Handler.
 *
 * POST appends one Dynamic Rule to a promo after RBAC validation.
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
import { BenefitType } from "@domain/enums";
import type { CreateRuleInput } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toCreateRuleInput(body: Record<string, unknown>): CreateRuleInput {
  return {
    minQuantity: asNumber(body.minQuantity),
    benefitType: body.benefitType as BenefitType,
    discountPercent: asNumber(body.discountPercent),
    gift: asString(body.gift),
  };
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
    const promo = await promoService.addRule(id, toCreateRuleInput(body));
    return NextResponse.json(promo, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
