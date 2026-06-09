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
}

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
  className?: string;
}

/**
 * Dense, generic data table tuned for desktop listings (sticky header,
 * compact rows, numeric alignment). Empty state content can be supplied by
 * the caller; module-specific Empty States are handled separately.
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
  className,
}: TableProps<Row>) {
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
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{
                  width: column.width,
                  textAlign: column.numeric ? "right" : column.align,
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="pms-table__empty" colSpan={columns.length}>
                {emptyContent}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
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
    </div>
  );
}
