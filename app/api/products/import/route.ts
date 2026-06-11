/**
 * Product import Route Handler.
 *
 * Accepts parsed text content from CSV/TSV exports, partitions rows into
 * created and failed entries, and returns per-row validation feedback plus the
 * summary invariant `created + failed === total`.
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
import { parseProductImportContent, ValidationError } from "@services/index";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

  const brandId = asString(body.brandId).trim();
  const content = asString(body.content);
  if (brandId === "" || content.trim() === "") {
    return errorResponse(
      new ValidationError("Data impor produk tidak valid.", {
        ...(brandId === "" ? { brandId: "Brand wajib diisi." } : {}),
        ...(content.trim() === ""
          ? { content: "Konten CSV/TSV wajib diisi." }
          : {}),
      }),
    );
  }

  try {
    const rows = parseProductImportContent(content);
    const { productService } = await getContainer();
    const result = await productService.importProducts(
      { brandId, rows },
      subject.userId,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
