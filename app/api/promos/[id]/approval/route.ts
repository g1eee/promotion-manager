/**
 * Promo approval Route Handler.
 *
 * PATCH changes Draft/Review/Approved/Rejected workflow status after SPV-only
 * RBAC and records Approval_History atomically in the service layer.
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
import { PromoStatus } from "@domain/enums";
import type { ChangeApprovalStatusInput } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function toChangeStatusInput(
  body: Record<string, unknown>,
): ChangeApprovalStatusInput {
  return {
    status: body.status as PromoStatus,
  };
}

export async function PATCH(
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
    const { approvalService } = await getContainer();
    const promo = await approvalService.changeStatus(
      id,
      toChangeStatusInput(body),
      subject.userId,
    );
    return NextResponse.json(promo, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
