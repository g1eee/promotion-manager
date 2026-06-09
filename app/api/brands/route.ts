/**
 * Brand collection Route Handler — `POST /api/brands` (Task 5.2, Req 19.1).
 *
 * Creates a Brand after enforcing RBAC: only SPV_Marketing may write the five
 * controlled resources and the Brand configuration module; Admin_Marketplace is
 * rejected with an access-denied message (Req 1.2, 1.6). The authenticated
 * subject's id is recorded as `createdBy` (audit fields, Req 23.2).
 *
 * Validation and uniqueness are owned by {@link BrandService}; any thrown
 * domain/persistence error is mapped to the right HTTP status by
 * {@link errorResponse} (validation → 422, duplicate Brand ID → 422/409).
 *
 * `GET /api/brands` lists every Brand (many Brands are supported, Req 19.9) so
 * the Brand Management screen can render the listing. Reading is an SPV-only
 * configuration concern: {@link authorizeRequest} allows SPV_Marketing and
 * denies Admin_Marketplace (Req 1.6).
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
import type { CreateBrandInput } from "@services/index";

/** Coerce an unknown body field to a trimmed string (or "" when absent). */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Build the {@link CreateBrandInput} from a raw JSON body. `status` defaults to
 * Active when omitted; an unrecognized value is passed through so the service's
 * field validation produces the canonical "Status harus..." message.
 */
function toCreateInput(body: Record<string, unknown>): CreateBrandInput {
  const rawStatus = body.status;
  const status =
    rawStatus === undefined || rawStatus === null
      ? BrandStatus.Active
      : (rawStatus as BrandStatus);
  return {
    brandId: asString(body.brandId),
    brandName: asString(body.brandName),
    displayName: asString(body.displayName),
    status,
  };
}

export async function GET(): Promise<NextResponse> {
  const subject = await authorizeRequest(AccessAction.Read, AccessResource.Brand);
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { brandService } = await getContainer();
    const brands = await brandService.list();
    return NextResponse.json(brands, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(AccessAction.Create, AccessResource.Brand);
  if (isResponse(subject)) {
    return subject;
  }

  const body = await parseJsonBody(request);
  if (isResponse(body)) {
    return body;
  }

  try {
    const { brandService } = await getContainer();
    const brand = await brandService.create(toCreateInput(body), subject.userId);
    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
