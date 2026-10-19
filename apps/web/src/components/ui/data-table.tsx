import { cn } from "@formbuilder/ui";

/*
 * A real table: a screen reader announces "column 2 of 4, Role" in a table and
 * nothing in a grid of divs. The caption is required, visually hidden, never
 * absent.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/DataTable.tsx. Compare against it on the next sync.
 *
 * `relative` is load-bearing: the sr-only caption is absolutely positioned,
 * and without a positioned ancestor it widens the page and causes a sideways
 * scroll on a phone. Wide content scrolls inside its own box, with `.scroll-x`
 * shadows on whichever edge has more to show.
 */
export interface Column<Row> {
  key: string;
  header: React.ReactNode;
  /** Right-aligns and applies tabular numerals. */
  numeric?: boolean;
  width?: string;
  cell: (row: Row) => React.ReactNode;
  sorted?: "ascending" | "descending";
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  className,
}: {
  caption: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("surface scroll-x relative overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sorted}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "whitespace-nowrap border-b border-rule bg-paper-sunk px-4 py-2.5",
                  "font-mono text-[0.625rem] font-medium uppercase tracking-[0.11em] text-graphite-soft",
                  column.numeric ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-rule last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-2.5 align-middle", column.numeric && "tabular text-right")}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
