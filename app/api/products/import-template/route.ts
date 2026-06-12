/**
 * Product import template Route Handler.
 *
 * Serves a CSV template with the canonical Product Master headers used by the
 * import parser and documented in Task 6.4.
 */

import { AccessAction, AccessResource } from "@/auth";
import { authorizeRequest, isResponse } from "@/api/http";

const TEMPLATE_HEADERS = [
  "Product ID",
  "Nama Produk",
  "Kategori",
  "HPP",
  "Harga Jual",
  "Status",
];

export async function GET(): Promise<Response> {
  const subject = await authorizeRequest(
    AccessAction.Read,
    AccessResource.ProductMaster,
  );
  if (isResponse(subject)) {
    return subject;
  }

  const content = `${TEMPLATE_HEADERS.join(",")}\r\n`;
  return new Response(content, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="product-import-template.csv"',
    },
  });
}
