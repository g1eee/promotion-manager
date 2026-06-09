/**
 * Single-Brand Route Handler — `PATCH` (update) and `DELETE` on
 * `/api/brands/[id]` (Task 5.2, Req 19.3, 19.6).
 *
 * Both verbs are write operations gated by RBAC: SPV_Marketing is allowed,
 * Admin_Marketplace is denied (Req 1.2, 1.6). `AccessAction.Update` represents
 * any mutation on the Brand (the controller has no separate Delete action; the
 * all-or-nothing grant decides identically for either).
 *
 * - PATCH applies only the provided fields and persists only when every
 *   validation/constraint passes; otherwise the stored Brand is preserved
 *   (Req 19.3, 19.4). A missing Brand → 404, invalid/duplicate → 422/409.
 * - DELETE removes the Brand only when it owns no Product/Campaign/Promo; when
 *   related data exists the service raises a referential-integrity error that
 *   maps to 409 with a "masih memiliki data terkait" message guiding the user
 *   toward Archive (Req 19.6).
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
import { BrandStatus } from "@domain/enums";
import type { UpdateBrandChanges } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

/**
 * Extract only the mutable Brand fields that are present in the body. Omitted
 * keys are left untouched by {@link BrandService.update} (Req 19.3); present
 * keys are coerced to their declared types so the service validates them.
 */
function toUpdateChanges(body: Record<string, unknown>): UpdateBrandChanges {
  const changes: UpdateBrandChanges = {};
  if (typeof body.brandId === "string") {
    changes.brandId = body.brandId;
  }
  if (typeof body.brandName === "string") {
    changes.brandName = body.brandName;
  }
  if (typeof body.displayName === "string") {
    changes.displayName = body.displayName;
  }
  if (body.status !== undefined) {
    changes.status = body.status as BrandStatus;
  }
  return changes;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(AccessAction.Update, AccessResource.Brand);
  if (isResponse(subject)) {
    return subject;
  }

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { id } = await context.params;
    const { brandService } = await getContainer();
    const brand = await brandService.update(id, toUpdateChanges(body));
    return NextResponse.json(brand, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(AccessAction.Update, AccessResource.Brand);
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { brandService } = await getContainer();
    await brandService.delete(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
