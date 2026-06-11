"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export interface TableColumn<Row> {
  /** Unique key for the column. */
  key: string;
  /** Header content. */
  header: ReactNode;
  /** Cell renderer. Receives the row and its index. */
  render: (row: Row, rowIndex: number) => ReactNode;
  /** Horizontal alignment of the cell content. Defaults to "left". */
  align?: "left" | "center" | "right";
  /** Render the column as numeric (right-aligned, tabular figures). */
  numeric?: boolean;
  /** Optional fixed/min width (any CSS width value). */
  width?: string;
  /**
   * Make the column sortable. Provide a comparator value for the row; the table
   * sorts by this value when the header is clicked. Strings sort
   * case-insensitively, numbers and Dates numerically.
   */
  sortValue?: (row: Row) => string | number | Date;
}

type SortDirection = "asc" | "desc";

export interface TableProps<Row> {
  /** Column definitions. */
  columns: TableColumn<Row>[];
  /** Row data. */
  data: Row[];
  /** Derive a stable React key for each row. */
  rowKey: (row: Row, rowIndex: number) => string | number;
  /** Reduce cell padding for very dense listings. */
  compact?: boolean;
  /** Zebra striping. */
  striped?: boolean;
  /** Highlight rows on hover. */
  hoverable?: boolean;
  /** Content shown when `data` is empty. */
  emptyContent?: ReactNode;
  /** Accessible caption / label for the table. */
  caption?: ReactNode;
  /**
   * Rows per page. When set (and less than the row count), the table paginates
   * client-side with a footer control. Omit to render every row.
   */
  pageSize?: number;
  className?: string;
}

function compareValues(
  a: string | number | Date,
  b: string | number | Date,
): number {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

/**
 * Dense, generic data table tuned for desktop listings (sticky header, compact
 * rows, numeric alignment). Supports opt-in client-side column sorting
 * (`column.sortValue`) and pagination (`pageSize`). Empty state content can be
 * supplied by the caller; module-specific Empty States are handled separately.
 */
export function Table<Row>({
  columns,
  data,
  rowKey,
  compact = true,
  striped = false,
  hoverable = true,
  emptyContent = "Tidak ada data.",
  caption,
  pageSize,
  className,
}: TableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDirection } | null>(
    null,
  );
  const [page, setPage] = useState(0);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const accessor = column.sortValue;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort(
      (a, b) => compareValues(accessor(a), accessor(b)) * factor,
    );
  }, [data, sort, columns]);

  const paginated = pageSize && pageSize > 0;
  const pageCount = paginated ? Math.ceil(sortedData.length / pageSize) : 1;
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleData = paginated
    ? sortedData.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sortedData;

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((current) => {
      if (current?.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  return (
    <div className="pms-table-wrap">
      <table
        className={cx(
          "pms-table",
          compact && "pms-table--compact",
          striped && "pms-table--striped",
          hoverable && "pms-table--hoverable",
          className,
        )}
      >
        {caption != null && (
          <caption className="pms-visually-hidden">{caption}</caption>
        )}
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const sorted = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sorted
                      ? sort?.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  style={{
                    width: column.width,
                    textAlign: column.numeric ? "right" : column.align,
                  }}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={cx(
                        "pms-table__sort",
                        sorted && "pms-table__sort--active",
                      )}
                      onClick={() => toggleSort(column.key)}
                    >
                      <span>{column.header}</span>
                      <span className="pms-table__sort-icon" aria-hidden="true">
                        {sorted ? (sort?.dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibleData.length === 0 ? (
            <tr>
              <td className="pms-table__empty" colSpan={columns.length}>
                {emptyContent}
              </td>
            </tr>
          ) : (
            visibleData.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(column.numeric && "pms-table__cell--numeric")}
                    style={{
                      textAlign: column.numeric ? undefined : column.align,
                    }}
                  >
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {paginated && sortedData.length > pageSize && (
        <div className="pms-table__pagination">
          <span className="pms-table__pagination-info">
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sortedData.length)} dari{" "}
            {sortedData.length}
          </span>
          <div className="pms-table__pagination-controls">
            <button
              type="button"
              className="pms-table__pagination-btn"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Sebelumnya
            </button>
            <span className="pms-table__pagination-page">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="pms-table__pagination-btn"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
