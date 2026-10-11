"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconSortNeutral, IconSortAsc, IconSortDesc } from "@/components/icons";

export interface Column<T> {
  key: string;
  header: string;
  /** Defaults to `String(row[key])` when omitted — set this for anything non-primitive or formatted. */
  cell?: (row: T, index: number) => ReactNode;
  /** Value compared when sorting. Required for a `sortable` column unless `key` is itself a primitive field on `T`. */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: number | string;
}

export interface FilterOption {
  value: string;
  label: string;
}

/** One "all / X / Y / …" dropdown rendered in the table's toolbar. Multiple filters AND together. */
export interface TableFilter<T> {
  key: string;
  label: string;
  options: FilterOption[];
  /** The row's value to compare against the selected option's `value`. */
  value: (row: T) => string;
  allLabel?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  /** Wraps each cell's content in a `<Link>` — an anchor can't legally wrap a `<tr>`. */
  getRowHref?: (row: T) => string | undefined;
  /** Rendered as a trailing, unlabeled column when present. */
  actions?: (row: T) => ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Defaults to matching against every column's rendered-as-string value. */
  getSearchText?: (row: T) => string;
  /** Dropdown filters shown in the toolbar alongside search, applied (AND) before search and sort. */
  filters?: TableFilter<T>[];
  /** Enables client-side pagination at this page size. Omit to render every row. */
  pageSize?: number;
  /** Table gets `overflow-x: auto` automatically (RESPONSIVE.md) — this sets the column layout's floor before it scrolls instead of crushing. */
  minWidth?: number;
  className?: string;
  /** Rendered inside the table's own card, below the rows — e.g. an "add new row" form — so it reads as part of the table instead of a separate orphaned card. */
  footer?: ReactNode;
}

type SortDirection = "asc" | "desc";

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, "left" | "center" | "right"> = {
  left: "left",
  center: "center",
  right: "right",
};

function cellValue<T>(column: Column<T>, row: T): unknown {
  return (row as Record<string, unknown>)[column.key];
}

/**
 * One reusable table for every list screen in the app — sorting, search,
 * dropdown filters, pagination, loading/error/empty states, an optional
 * actions column, optional whole-row links, and an optional `footer` (e.g.
 * an "add new row" form, rendered inside the same card so it reads as part
 * of the table rather than a separate floating card) — all in one place
 * instead of hand-rolling a `<table>` per feature. Always wraps itself in
 * `.table-scroll` (RESPONSIVE.md) so a wide column set scrolls instead of
 * clipping.
 *
 * A cell that needs live state (an inline slider, an editable date field)
 * is still fine here — give it its own named component and reference that
 * component from `column.cell`, rather than inlining hooks in a bare
 * closure (see `ActivityCells.tsx` for an example shared with a non-table
 * page too).
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  getRowHref,
  actions,
  loading,
  error,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  searchable,
  searchPlaceholder = "Search…",
  getSearchText,
  filters,
  pageSize,
  minWidth = 560,
  className,
  footer,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [page, setPage] = useState(1);

  const searchTextOf =
    getSearchText ??
    ((row: T) =>
      columns
        .map((c) => (c.cell ? "" : String(cellValue(c, row) ?? "")))
        .join(" ")
        .toLowerCase());

  const matchesFilters = useMemo(() => {
    if (!filters || filters.length === 0) return data;
    return data.filter((row) =>
      filters.every((f) => {
        const selected = filterValues[f.key];
        return !selected || f.value(row) === selected;
      })
    );
  }, [data, filters, filterValues]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return matchesFilters;
    const needle = query.trim().toLowerCase();
    return matchesFilters.filter((row) => searchTextOf(row).toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchesFilters, searchable, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return filtered;
    const valueOf = column.sortValue ?? ((row: T) => cellValue(column, row) as string | number);
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const clampedPage = Math.min(page, pageCount);
  const paged = pageSize ? sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize) : sorted;

  // A new search or filter narrows the result set — always land back on page 1 rather than a now out-of-range page.
  useEffect(() => setPage(1), [query, filterValues]);

  const columnCount = columns.length + (actions ? 1 : 0);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function renderCell(column: Column<T>, row: T, index: number): ReactNode {
    const content = column.cell ? column.cell(row, index) : String(cellValue(column, row) ?? "—");
    const href = getRowHref?.(row);
    return href ? (
      <Link href={href} style={{ display: "block", color: "inherit" }}>
        {content}
      </Link>
    ) : (
      content
    );
  }

  const hasToolbar = (searchable || (filters && filters.length > 0)) && !loading && !error;

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hasToolbar && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {searchable && (
            <input
              className="input"
              style={{ maxWidth: 320, flex: "1 1 200px" }}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              className="input"
              style={{ maxWidth: 200, flex: "1 1 160px" }}
              value={filterValues[f.key] ?? ""}
              onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            >
              <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      <div className="card table-scroll" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: "0.9em" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "var(--surface-muted)" }}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      padding: "10px 14px",
                      fontWeight: 600,
                      fontSize: "0.85em",
                      borderBottom: "1px solid var(--border)",
                      textAlign: ALIGN[column.align ?? "left"],
                      width: column.width,
                    }}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "none",
                          border: "none",
                          padding: 0,
                          font: "inherit",
                          fontWeight: 600,
                          color: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {column.header}
                        <SortIcon active={sort?.key === column.key} direction={sort?.key === column.key ? sort.direction : undefined} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {actions && <th style={{ borderBottom: "1px solid var(--border)" }} />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} style={{ padding: "32px 14px", textAlign: "center" }} className="muted">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnCount} style={{ padding: "32px 14px", textAlign: "center" }}>
                    <p className="error-text" style={{ marginBottom: onRetry ? 10 : 0 }}>
                      {error}
                    </p>
                    {onRetry && (
                      <button className="btn" onClick={onRetry}>
                        Try again
                      </button>
                    )}
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} style={{ padding: "32px 14px", textAlign: "center" }}>
                    <p style={{ fontWeight: 600, marginBottom: emptyDescription ? 4 : 0 }}>{emptyTitle}</p>
                    {emptyDescription && (
                      <p className="muted" style={{ fontSize: "0.9em" }}>
                        {emptyDescription}
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                paged.map((row, index) => (
                  <tr key={rowKey(row)} style={{ borderBottom: "1px solid var(--border)" }}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        style={{ padding: "10px 14px", textAlign: ALIGN[column.align ?? "left"], verticalAlign: "top" }}
                      >
                        {renderCell(column, row, index)}
                      </td>
                    ))}
                    {actions && (
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {footer && <div style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </div>

      {pageSize && !loading && !error && sorted.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: "0.85em" }}>
            {sorted.length} row{sorted.length === 1 ? "" : "s"} · page {clampedPage} of {pageCount}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn" disabled={clampedPage >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ active, direction }: { active?: boolean; direction?: SortDirection }) {
  if (!active) return <IconSortNeutral />;
  return direction === "asc" ? <IconSortAsc /> : <IconSortDesc />;
}
