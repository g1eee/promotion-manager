/**
 * Brand Cost Configuration Route Handler.
 *
 * GET returns the Brand's ten cost components; PUT validates and saves the
 * active Cost_Configuration atomically for the Brand.
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
import {
  COST_COMPONENT_KEYS,
  type CostComponents,
  ValidationError,
} from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function toComponents(body: Record<string, unknown>): CostComponents {
  const components = {} as CostComponents;
  for (const key of COST_COMPONENT_KEYS) {
    components[key] = asNumber(body[key]);
  }
  return components;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.CostConfiguration,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { costConfigService } = await getContainer();
    const config = await costConfigService.get(id);
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.CostConfiguration,
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
    if (id.trim() === "") {
      throw new ValidationError("Brand tidak valid.", {
        brandId: "Brand wajib diisi.",
      });
    }
    const { costConfigService } = await getContainer();
    const config = await costConfigService.update(id, toComponents(body));
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
