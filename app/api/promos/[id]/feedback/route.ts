/**
 * Promo Feedback thread Route Handler (Req 14.4–14.6, Req 1.4, 1.5).
 *
 * GET lists the full feedback thread for a promo (oldest-first). POST appends a
 * new Feedback_Record. Both SPV_Marketing and Admin_Marketplace with access to
 * the promo may read and create feedback — the two-way discussion thread
 * (Req 1.5) — so RBAC gates on the Feedback_Record resource, which the access
 * controller allows Create/Read for both roles.
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

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.FeedbackRecord,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { feedbackService } = await getContainer();
    const thread = await feedbackService.list(id);
    return NextResponse.json(thread, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
    AccessResource.FeedbackRecord,
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
    const { feedbackService } = await getContainer();
    const record = await feedbackService.add(
      id,
      { message: typeof body.message === "string" ? body.message : "" },
      subject.userId,
    );
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
