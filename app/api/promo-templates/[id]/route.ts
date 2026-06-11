/**
 * Promo Template item Route Handler (Req 5.4, 5.5).
 *
 * PUT updates an existing template; DELETE removes it. Both are writes on
 * Promo_Template, gated to SPV only (Req 1.2/1.6).
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { getContainer } from "@/api/container";
import {
  authorizeRequest,
  errorResponse,
  isResponse,
  parseJsonBody,
} from "@/api/http";
import { PromoType } from "@domain/enums";
import type { PromoTemplateConfig } from "@domain/types";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function parsePromoType(value: unknown): PromoType | null {
  if (typeof value !== "string") return null;
  return (Object.values(PromoType) as string[]).includes(value)
    ? (value as PromoType)
    : null;
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.PromoTemplate,
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
    const { promoTemplateService } = await getContainer();
    const template = await promoTemplateService.update(id, {
      name: typeof body.name === "string" ? body.name : "",
      promoType: parsePromoType(body.promoType),
      config: (body.config as PromoTemplateConfig) ?? { rules: [] },
    });
    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.PromoTemplate,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { promoTemplateService } = await getContainer();
    await promoTemplateService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
