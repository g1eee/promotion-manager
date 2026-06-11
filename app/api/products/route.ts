/**
 * Product Master collection Route Handler.
 *
 * GET lists/searches products with optional `keyword` and `brandId` filters.
 * POST creates one Product after RBAC and service validation. Product identity
 * stays scoped to `(brandId, productId)` and names are never unique keys.
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
import type { CreateProductInput } from "@services/index";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function toCreateInput(body: Record<string, unknown>): CreateProductInput {
  const rawStatus = body.status;
  const status =
    rawStatus === undefined || rawStatus === null
      ? ProductStatus.Active
      : (rawStatus as ProductStatus);
  return {
    brandId: asString(body.brandId),
    productId: asString(body.productId),
    namaProduk: asString(body.namaProduk),
    kategori: asString(body.kategori),
    hpp: asNumber(body.hpp),
    hargaJual: asNumber(body.hargaJual),
    status,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.ProductMaster,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword") ?? undefined;
  const brandId = url.searchParams.get("brandId") ?? undefined;

  try {
    const { productService } = await getContainer();
    const products = await productService.search({ keyword, brandId });
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const subject = await authorizeRequest(
    AccessAction.Create,
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
    const { productService } = await getContainer();
    const result = await productService.create(
      toCreateInput(body),
      subject.userId,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
