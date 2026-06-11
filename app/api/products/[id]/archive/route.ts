/**
 * Product archive Route Handler.
 *
 * Marks a Product as Archived without deleting it, preserving historical promo
 * references while hiding it from normal product selection.
 */

import { NextResponse } from "next/server";
import { AccessAction, AccessResource } from "@/auth";
import { authorizeRequest, errorResponse, isResponse } from "@/api/http";
import { getContainer } from "@/api/container";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.ProductMaster,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { productService } = await getContainer();
    const product = await productService.archive(id, subject.userId);
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
