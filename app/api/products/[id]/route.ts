/**
 * Product Master item Route Handler.
 *
 * PATCH updates mutable Product fields and DELETE permanently removes only
 * products that are not referenced by any Promo_Scenario. Referenced products
 * are rejected by the service and should be archived instead.
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
import { ProductStatus } from "@domain/enums";
import type { UpdateProductInput } from "@services/index";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function toUpdateInput(body: Record<string, unknown>): UpdateProductInput {
  const changes: UpdateProductInput = {};
  if (typeof body.productId === "string") changes.productId = body.productId;
  if (typeof body.namaProduk === "string") changes.namaProduk = body.namaProduk;
  if (typeof body.kategori === "string") changes.kategori = body.kategori;
  if (typeof body.hpp === "number") changes.hpp = body.hpp;
  if (typeof body.hpp === "string" && body.hpp.trim() !== "") {
    changes.hpp = Number(body.hpp);
  }
  if (typeof body.hargaJual === "number") changes.hargaJual = body.hargaJual;
  if (typeof body.hargaJual === "string" && body.hargaJual.trim() !== "") {
    changes.hargaJual = Number(body.hargaJual);
  }
  if (body.status !== undefined) changes.status = body.status as ProductStatus;
  return changes;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Update,
    AccessResource.ProductMaster,
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
    const { productService } = await getContainer();
    const product = await productService.update(
      id,
      toUpdateInput(body),
      subject.userId,
    );
    return NextResponse.json(product, { status: 200 });
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
    AccessResource.ProductMaster,
  );
  if (isResponse(subject)) {
    return subject;
  }

  try {
    const { id } = await context.params;
    const { productService } = await getContainer();
    await productService.delete(id, subject.userId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
