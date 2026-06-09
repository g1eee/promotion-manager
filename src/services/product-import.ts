/**
 * Product import — core parsing & partition primitives (Req 3.12, 3.13).
 *
 * This module owns the *pure* part of the Product Master import pipeline: it
 * turns raw Excel/CSV content into structured, header-keyed rows that the
 * {@link ProductService.importProducts} partition step consumes. It performs no
 * I/O and depends on nothing but the domain types, so it can be exercised
 * exhaustively by unit and property tests.
 *
 * The pipeline is intentionally split into two stages so later tasks can build
 * on it without reshaping the core:
 *
 * 1. Decode the file into a 2-D string matrix (header row + data rows). CSV/TSV
 *    text is decoded here by {@link parseDelimitedContent}; an `.xlsx` binary is
 *    decoded by an adapter (Task 6.8) into the same matrix shape, so both feed
 *    the identical downstream logic.
 * 2. Map the matrix into {@link RawImportRow}s keyed by canonical product field
 *    names ({@link rowsFromMatrix}), each tagged with the 1-based data-row
 *    number the user sees in their spreadsheet.
 *
 * The partition itself — every valid row becomes exactly one Product and every
 * invalid/error row lands on the failed list, with
 * `created + failed === total` — lives in {@link ProductService.importProducts}
 * (design "Property 9").
 */

/**
 * Canonical product field keys an import row is mapped onto. These are the
 * stable internal names; the human column headers in the file (e.g. "Product
 * ID", "Nama Produk", "Harga Jual") are matched to them case-insensitively.
 */
export type ProductImportColumn =
  | "productId"
  | "namaProduk"
  | "kategori"
  | "hpp"
  | "hargaJual"
  | "status"
  | "brand";

/**
 * A single parsed data row from an import file, ready for the partition step.
 * `values` is keyed by {@link ProductImportColumn}; missing columns are simply
 * absent so the service can report them as validation failures per row.
 */
export interface RawImportRow {
  /**
   * 1-based position of this row among the *data* rows (header excluded), i.e.
   * the number a user counts in their spreadsheet body. Stable across the
   * pipeline so failures can be reported against the original row.
   */
  readonly rowNumber: number;
  /** Trimmed cell values keyed by canonical column name. */
  readonly values: Readonly<Partial<Record<ProductImportColumn, string>>>;
}

/**
 * Map of recognised header labels (normalized to lowercase, collapsed
 * whitespace) to their canonical {@link ProductImportColumn}. Mirrors the
 * Download Template headers from the design (Product ID, Nama Produk, Kategori,
 * HPP, Harga Jual, Status, Brand) and tolerates common spelling variants.
 */
const HEADER_ALIASES: Readonly<Record<string, ProductImportColumn>> = {
  "product id": "productId",
  productid: "productId",
  "id produk": "productId",
  "nama produk": "namaProduk",
  "product name": "namaProduk",
  nama: "namaProduk",
  kategori: "kategori",
  category: "kategori",
  hpp: "hpp",
  "harga pokok": "hpp",
  "harga pokok produksi": "hpp",
  "harga jual": "hargaJual",
  hargajual: "hargaJual",
  "selling price": "hargaJual",
  status: "status",
  brand: "brand",
};

/** Normalize a header label for alias lookup: trim, lowercase, collapse spaces. */
function normalizeHeader(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Decode delimited text (CSV/TSV) into a 2-D matrix of raw cell strings,
 * following RFC 4180 quoting rules: fields may be wrapped in double quotes,
 * embedded quotes are escaped by doubling (`""`), and quoted fields may contain
 * the delimiter and newlines. A leading UTF-8 BOM is stripped. Both `\r\n` and
 * `\n` line endings are accepted.
 *
 * The delimiter is auto-detected from the first line as the most frequent of
 * comma, semicolon, or tab (defaulting to comma), so locale exports that use
 * `;` are handled without configuration.
 *
 * @returns One array per record; each inner array holds that record's cells.
 *   Fully empty lines are skipped so trailing blank lines never create phantom
 *   rows.
 */
export function parseDelimitedContent(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  if (text.trim() === "") {
    return [];
  }

  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let rowHasContent = false;

  const endField = (): void => {
    row.push(field);
    if (field.trim() !== "") {
      rowHasContent = true;
    }
    field = "";
  };
  const endRow = (): void => {
    endField();
    if (rowHasContent) {
      rows.push(row);
    }
    row = [];
    rowHasContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      // Swallow CR; the following LF (if any) triggers the row break.
      if (text[i + 1] !== "\n") {
        endRow();
      }
    } else {
      field += char;
    }
  }

  // Flush the final field/row when the file does not end with a newline.
  if (field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
}

/** Pick the most frequent of `,`, `;`, `\t` on the first line; default `,`. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates: string[] = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Map a decoded matrix (first row = headers) into {@link RawImportRow}s keyed by
 * canonical column name. Unrecognised header columns are ignored; recognised
 * columns are paired with their cell value (trimmed). Each data row is tagged
 * with its 1-based `rowNumber` (header excluded).
 *
 * A matrix with no rows, or only a header row, yields an empty list.
 */
export function rowsFromMatrix(matrix: readonly (readonly string[])[]): RawImportRow[] {
  if (matrix.length < 2) {
    return [];
  }

  const header = matrix[0] ?? [];
  const columnMap: (ProductImportColumn | undefined)[] = header.map(
    (label) => HEADER_ALIASES[normalizeHeader(label)],
  );

  const rows: RawImportRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    const values: Partial<Record<ProductImportColumn, string>> = {};
    for (let c = 0; c < columnMap.length; c++) {
      const column = columnMap[c];
      if (column === undefined) {
        continue;
      }
      const raw = cells[c];
      if (typeof raw === "string") {
        values[column] = raw.trim();
      }
    }
    rows.push({ rowNumber: r, values });
  }
  return rows;
}

/**
 * Convenience CSV/TSV entry point: decode delimited `content` and map it to
 * canonical {@link RawImportRow}s in one step. Excel callers decode their sheet
 * to a matrix and call {@link rowsFromMatrix} directly instead.
 */
export function parseProductImportContent(content: string): RawImportRow[] {
  return rowsFromMatrix(parseDelimitedContent(content));
}

/**
 * One row that could not be imported (Req 3.13). `row` is the 1-based data-row
 * number; `reason` is a human-readable explanation; `fields` carries optional
 * per-field validation messages (populated for validation failures, supporting
 * the per-row Import Validation Feedback of Task 6.5).
 */
export interface FailedImportRow {
  readonly row: number;
  readonly reason: string;
  readonly fields?: Readonly<Record<string, string>>;
}
