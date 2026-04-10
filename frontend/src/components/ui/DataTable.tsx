import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SKYNEX DataTable Component
// Issue #85: High-density data table with sorting and selection
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  /** Unique column identifier */
  id: string;
  /** Column header label */
  header: string;
  /** Accessor function or key path */
  accessor: keyof T | ((row: T) => ReactNode);
  /** Column width (CSS value or number for px) */
  width?: string | number;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom cell renderer */
  cell?: (value: unknown, row: T) => ReactNode;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface DataTableProps<T extends { id: string | number }> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data rows */
  rows: T[];
  /** Enable row selection */
  selectable?: boolean;
  /** Currently selected row IDs */
  selectedIds?: Set<string | number>;
  /** Selection change callback */
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
  /** Sort state (controlled) */
  sortState?: SortState;
  /** Sort change callback */
  onSortChange?: (sort: SortState) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Sticky header */
  stickyHeader?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  sortState: controlledSortState,
  onSortChange,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  stickyHeader = true,
  className = '',
  ...props
}: DataTableProps<T>) {
  // Internal state for uncontrolled mode
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string | number>>(new Set());
  const [internalSortState, setInternalSortState] = useState<SortState>({ columnId: '', direction: null });

  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const sortState = controlledSortState ?? internalSortState;

  // ─── Selection handlers ───────────────────────────────────────────────────
  const toggleSelectAll = useCallback(() => {
    const allSelected = rows.length > 0 && selectedIds.size === rows.length;
    const newSelection = allSelected ? new Set<string | number>() : new Set(rows.map((r) => r.id));

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedIds(newSelection);
    }
  }, [rows, selectedIds, onSelectionChange]);

  const toggleSelectRow = useCallback(
    (id: string | number, event: React.MouseEvent) => {
      const newSelection = new Set(selectedIds);

      if (event.shiftKey && selectedIds.size > 0) {
        // Shift-click: select range
        const lastSelected = Array.from(selectedIds).pop();
        const lastIndex = rows.findIndex((r) => r.id === lastSelected);
        const currentIndex = rows.findIndex((r) => r.id === id);
        const [start, end] = [Math.min(lastIndex, currentIndex), Math.max(lastIndex, currentIndex)];

        for (let i = start; i <= end; i++) {
          newSelection.add(rows[i].id);
        }
      } else {
        // Normal click: toggle single row
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
      }

      if (onSelectionChange) {
        onSelectionChange(newSelection);
      } else {
        setInternalSelectedIds(newSelection);
      }
    },
    [rows, selectedIds, onSelectionChange]
  );

  // ─── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (columnId: string) => {
      let newDirection: SortDirection = 'asc';

      if (sortState.columnId === columnId) {
        if (sortState.direction === 'asc') newDirection = 'desc';
        else if (sortState.direction === 'desc') newDirection = null;
      }

      const newSortState = { columnId, direction: newDirection };

      if (onSortChange) {
        onSortChange(newSortState);
      } else {
        setInternalSortState(newSortState);
      }
    },
    [sortState, onSortChange]
  );

  // ─── Sorted rows ───────────────────────────────────���──────────────────────
  const sortedRows = useMemo(() => {
    if (!sortState.direction || !sortState.columnId) return rows;

    const column = columns.find((c) => c.id === sortState.columnId);
    if (!column) return rows;

    return [...rows].sort((a, b) => {
      const accessor = column.accessor;
      const aVal = typeof accessor === 'function' ? accessor(a) : a[accessor];
      const bVal = typeof accessor === 'function' ? accessor(b) : b[accessor];

      let comparison = 0;
      if (aVal === null || aVal === undefined) comparison = 1;
      else if (bVal === null || bVal === undefined) comparison = -1;
      else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortState.direction === 'desc' ? -comparison : comparison;
    });
  }, [rows, columns, sortState]);

  // ─── Cell value getter ────────────────────────────────────────────────────
  const getCellValue = (row: T, column: DataTableColumn<T>): ReactNode => {
    const rawValue = typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];

    if (column.cell) {
      return column.cell(rawValue, row);
    }

    return rawValue as ReactNode;
  };

  // ─── Selection state ──────────────────────────────────────────────────────
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div
      className={`overflow-auto rounded-skx-md border border-ghost ${className}`}
      {...props}
    >
      <table className="w-full border-collapse">
        {/* Header */}
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className="bg-surface-container-low">
            {/* Selection checkbox */}
            {selectable && (
              <th className="w-12 p-3 text-left">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.id}
                className={[
                  'p-3 text-left',
                  'text-title-sm font-semibold text-on-surface',
                  column.sortable && 'cursor-pointer select-none hover:bg-surface-container-high',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ width: column.width }}
                onClick={column.sortable ? () => handleSort(column.id) : undefined}
              >
                <div className={`flex items-center gap-2 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                  <span>{column.header}</span>
                  {column.sortable && (
                    <SortIndicator
                      active={sortState.columnId === column.id}
                      direction={sortState.columnId === column.id ? sortState.direction : null}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {loading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {selectable && <td className="p-3"><SkeletonCell width={16} /></td>}
                {columns.map((column) => (
                  <td key={column.id} className="p-3">
                    <SkeletonCell width={typeof column.width === 'number' ? column.width * 0.6 : 80} />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            // Empty state
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="p-12 text-center text-on-surface-dim"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            // Data rows
            sortedRows.map((row, rowIndex) => {
              const isSelected = selectedIds.has(row.id);
              const isEven = rowIndex % 2 === 0;

              return (
                <tr
                  key={row.id}
                  className={[
                    'transition-colors',
                    // Zebra pattern (3% opacity shift)
                    isEven ? 'bg-transparent' : 'bg-surface-container/30',
                    // Selection
                    isSelected && 'bg-primary/10',
                    // Hover
                    'hover:bg-surface-container-high',
                    // Clickable
                    onRowClick && 'cursor-pointer',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => toggleSelectRow(row.id, e as unknown as React.MouseEvent)}
                        aria-label={`Select row ${row.id}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={[
                        'p-3',
                        'font-mono text-body-md tabular-nums text-on-surface',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {getCellValue(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, indeterminate, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={[
          'w-4 h-4 rounded-skx-xs',
          'bg-surface-container-lowest border border-ghost',
          'checked:bg-primary checked:border-primary',
          'focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface',
          'cursor-pointer',
        ].join(' ')}
        {...(indeterminate ? { 'data-indeterminate': true } : {})}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

interface SortIndicatorProps {
  active: boolean;
  direction: SortDirection;
}

function SortIndicator({ active, direction }: SortIndicatorProps) {
  return (
    <span className={`inline-flex flex-col ${active ? 'text-primary' : 'text-on-surface-dim'}`}>
      <svg className="w-3 h-3" viewBox="0 0 12 12">
        <path
          d="M6 2L10 6H2L6 2Z"
          fill={active && direction === 'asc' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1}
          opacity={active && direction === 'asc' ? 1 : 0.4}
        />
        <path
          d="M6 10L2 6H10L6 10Z"
          fill={active && direction === 'desc' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1}
          opacity={active && direction === 'desc' ? 1 : 0.4}
        />
      </svg>
    </span>
  );
}

interface SkeletonCellProps {
  width: number;
}

function SkeletonCell({ width }: SkeletonCellProps) {
  return (
    <div
      className="h-4 bg-surface-container-high rounded animate-pulse"
      style={{ width }}
    />
  );
}
