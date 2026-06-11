/**
 * Promo Execution status item Route Handler.
 *
 * PATCH updates the Execution_Status for an Approved promo after RBAC.
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
import { ExecutionStatus } from "@domain/enums";
import type { UpdateExecutionStatusInput } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ promoId: string }>;
}

function toUpdateInput(body: Record<string, unknown>): UpdateExecutionStatusInput {
  return {
    status: body.status as ExecutionStatus,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.ExecutionStatus,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { promoId } = await context.params;
    const { executionStatusService } = await getContainer();
    const promo = await executionStatusService.update(
      promoId,
      toUpdateInput(body),
    );
    return NextResponse.json(promo, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
