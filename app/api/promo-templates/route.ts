/**
 * Promo Templates collection Route Handler (Req 5).
 *
 * GET lists all templates (built-in + custom). POST creates a new custom
 * template. RBAC: read is open to authenticated SPV (the configuration module
 * is SPV-only); create is gated as a write on Promo_Template (SPV only,
 * Req 1.2/1.6).
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

function parsePromoType(value: unknown): PromoType | null {
  if (typeof value !== "string") return null;
  return (Object.values(PromoType) as string[]).includes(value)
    ? (value as PromoType)
    : null;
}

export async function GET(): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.PromoTemplate,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { promoTemplateService } = await getContainer();
    const templates = await promoTemplateService.list();
    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
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
    const { promoTemplateService } = await getContainer();
    const template = await promoTemplateService.create(
      {
        name: typeof body.name === "string" ? body.name : "",
        promoType: parsePromoType(body.promoType),
        config: (body.config as PromoTemplateConfig) ?? { rules: [] },
      },
      subject.userId,
    );
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
