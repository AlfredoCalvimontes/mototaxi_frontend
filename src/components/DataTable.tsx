import { useMemo, useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/EmptyState';

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Value used for sorting and text search; omit to make the column inert. */
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right';
  /** Hidden below `sm`. Keeps the table usable on the owner's phone. */
  secondary?: boolean;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption?: string;
  emptyMessage?: string;
  /** Renders a search box filtering on every sortable column. */
  searchPlaceholder?: string;
  initialSort?: { columnId: string; direction: 'asc' | 'desc' };
  rowClassName?: (row: T) => string | undefined;
};

function compare(a: string | number | null, b: string | number | null): number {
  if (a === null) return b === null ? 0 : 1; // nulls last, both directions
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es');
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  emptyMessage,
  searchPlaceholder,
  initialSort,
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => {
        const value = column.sortValue?.(row);
        return (
          value !== null && value !== undefined && String(value).toLowerCase().includes(needle)
        );
      }),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return filtered;
    const direction = sort.direction === 'asc' ? 1 : -1;
    // Sorting must not mutate the array React Query handed us.
    return [...filtered].sort(
      (a, b) => compare(column.sortValue!(a), column.sortValue!(b)) * direction,
    );
  }, [filtered, columns, sort]);

  function toggleSort(columnId: string) {
    setSort((current) =>
      current?.columnId === columnId
        ? { columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { columnId, direction: 'asc' },
    );
  }

  return (
    <div className="space-y-3">
      {searchPlaceholder && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        // Wide tables scroll inside their own container instead of pushing the
        // page sideways on a phone.
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-max text-left text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.sortValue);
                  const active = sort?.columnId === column.id;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={
                        active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      className={`px-3 py-2 font-medium ${column.align === 'right' ? 'text-right' : ''} ${
                        column.secondary ? 'hidden sm:table-cell' : ''
                      }`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          {column.header}
                          <span aria-hidden="true" className="text-[10px]">
                            {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
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
            <tbody className="divide-y divide-slate-100">
              {sorted.map((row) => (
                <tr key={rowKey(row)} className={rowClassName?.(row) ?? 'hover:bg-slate-50'}>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-3 py-2 align-middle ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${
                        column.secondary ? 'hidden sm:table-cell' : ''
                      }`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
