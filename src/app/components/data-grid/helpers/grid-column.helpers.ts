// pure functions: normalize GridColumn (string | GridColumn_) into GridColumn_, auto-generate
// columns from data, flatten a nested column tree into leaf columns, and compute the header matrix

import { propsFromString } from '@components/details/helpers/field-string.helpers';
import { keyFromFieldString } from '@components/details/helpers/field-keys.helpers';
import { labelFromFieldString } from '@components/details/helpers/field-labels.helpers';
import {
  GRID_COLUMN_PROPS,
  GridColumn,
  GridColumn_,
  GridColumnState,
} from '../interfaces/grid-column.interface';
import { GridHeaderCell, GridHeaderRow } from '../interfaces/grid-header.interface';

/** Normalizes one `GridColumn` (string shorthand or object) into a `GridColumn_`, recursing into nested `columns`. */
export function normalizeColumn<RowType = any>(
  column: GridColumn<RowType>,
  lastDotAsName = false,
): GridColumn_<RowType> {
  if (typeof column === 'string') {
    const props = propsFromString(column, GRID_COLUMN_PROPS, { key: 'key', lastDotAsName });
    const key = keyFromFieldString(column);
    // `'columns(...)'` (type(stringArray)) parses into a flat string[] of child keys/DSL
    // strings — e.g. 'address columns(address.city, address.zip)' — normalize each into a real
    // child GridColumn_ (recursing lets a child use its own shorthand too, e.g. 'as' aliases)
    if (Array.isArray(props?.['columns'])) {
      props['columns'] = (props['columns'] as string[])
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => normalizeColumn<RowType>(c, lastDotAsName));
    }
    // reuses the Details component's field-string DSL label rule (field-labels.helpers.ts), so
    // `'department as Department Name'` works here exactly like it does for Details field strings
    // — everything after ` as ` becomes the label, taking priority over lastDotAsName
    return {
      key,
      label: labelFromFieldString(column, lastDotAsName),
      ...props,
    } as GridColumn_<RowType>;
  }

  const normalized: GridColumn_<RowType> = {
    ...column,
    label: column.label ?? labelFromFieldString(column.key, lastDotAsName),
  };
  if (column.columns?.length) {
    normalized.columns = normalizeColumns(column.columns, lastDotAsName);
  }
  return normalized;
}

export function normalizeColumns<RowType = any>(
  columns: GridColumn<RowType>[],
  lastDotAsName = false,
): GridColumn_<RowType>[] {
  return columns.map((c) => normalizeColumn(c, lastDotAsName));
}

const AUTO_COLUMN_HIDDEN_KEYS = new Set(['_cellsProps', '_rowProps']);

function inferColumnType(value: unknown): GridColumn_['type'] {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
    return value.includes('T') ? 'datetime' : 'date';
  }
  return 'text';
}

/** Auto-generates columns from the shape of the first row, when `GridParameter.columns` is omitted. */
export function autoGenerateColumns<RowType = any>(
  row: RowType | undefined,
  maxAutoColumns = 6,
  lastDotAsName = false,
): GridColumn_<RowType>[] {
  if (!row || typeof row !== 'object') return [];
  return Object.keys(row as Record<string, unknown>)
    .filter((key) => !AUTO_COLUMN_HIDDEN_KEYS.has(key))
    .slice(0, maxAutoColumns)
    .map((key) => ({
      key,
      label: labelFromFieldString(key, lastDotAsName),
      type: inferColumnType((row as Record<string, unknown>)[key]),
      sortable: true,
    }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function collectColumnKeys(
  obj: Record<string, unknown>,
  prefix: string,
  seen: Map<string, unknown>,
): void {
  for (const key of Object.keys(obj)) {
    if (AUTO_COLUMN_HIDDEN_KEYS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (isPlainObject(value)) collectColumnKeys(value, path, seen);
    else if (!seen.has(path)) seen.set(path, value);
  }
}

/**
 * Scans ALL supplied rows (not just the first, so sparse/optional fields aren't missed) for keys
 * not already in `knownKeys`, recursing into nested plain objects (arrays/Dates are leaves, never
 * recursed into) to produce dotted-path keys matching how manually-configured columns already
 * look (e.g. `address.city`). Unlike `autoGenerateColumns`, this is uncapped — driven by an
 * explicit user action (`GridParameter.canAddColumns`), not an implicit fallback — and every
 * returned column starts `visible: false` (`columnState`'s own default then keeps it hidden until
 * the user checks it).
 */
export function discoverColumnsFromData<RowType = any>(
  rows: RowType[],
  knownKeys: Set<string>,
  lastDotAsName = false,
): GridColumn_<RowType>[] {
  const seen = new Map<string, unknown>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    collectColumnKeys(row as Record<string, unknown>, '', seen);
  }
  return Array.from(seen.entries())
    .filter(([key]) => !knownKeys.has(key))
    .map(
      ([key, value]) =>
        ({
          key,
          label: labelFromFieldString(key, lastDotAsName),
          type: inferColumnType(value),
          sortable: true,
          visible: false,
        }) as GridColumn_<RowType>,
    );
}

/** Leaf columns (no nested `columns`), in declaration order — what body rows actually render. */
export function flattenLeafColumns<RowType = any>(
  columns: GridColumn_<RowType>[],
): GridColumn_<RowType>[] {
  return columns.flatMap((col) => (col.columns?.length ? flattenLeafColumns(col.columns) : [col]));
}

/**
 * Leaf keys whose visibility is forced false by an ANCESTOR GROUP column with `visible === false`
 * in the static config tree — hiding a group hides its whole subtree, regardless of any
 * descendant's own `visible`/runtime column-state override. Deliberately only cascades a GROUP
 * node's (one with nested `columns`) own `visible: false` onto its descendants — a LEAF's own
 * `visible: false` (e.g. an auto-discovered column, created hidden by default until the user
 * opts in via the column panel) must NOT land here, or it'd be indistinguishable from a
 * group-hidden leaf and `columnState` (below) would hard-lock it, permanently ignoring the
 * runtime override that's supposed to be able to re-show it — only its own group ancestors matter
 * for this set; its own `visible` is already handled correctly by the normal
 * `override ?? col.visible ?? true` fallback chain. Only the STATIC `columns()` tree is consulted
 * here (not `columnState`'s per-leaf runtime overrides) — group columns never get their own
 * `GridColumnState` entry (only leaves do), so there'd otherwise be no way to toggle a whole
 * section off at once.
 */
export function collectAncestorHiddenLeafKeys<RowType = any>(
  columns: GridColumn_<RowType>[],
): Set<string> {
  const hidden = new Set<string>();
  const visit = (cols: GridColumn_<RowType>[], ancestorHidden: boolean): void => {
    for (const col of cols) {
      if (col.columns?.length) {
        visit(col.columns, ancestorHidden || col.visible === false);
      } else if (ancestorHidden) {
        hidden.add(col.key);
      }
    }
  };
  visit(columns, false);
  return hidden;
}

function isVisible(column: GridColumn_, visibleKeys?: Set<string>): boolean {
  if (!visibleKeys) return true;
  return column.columns?.length
    ? column.columns.some((c) => isVisible(c, visibleKeys))
    : visibleKeys.has(column.key);
}

function countLeaves(column: GridColumn_, visibleKeys?: Set<string>): number {
  if (!column.columns?.length) return isVisible(column, visibleKeys) ? 1 : 0;
  return column.columns.reduce((sum, c) => sum + countLeaves(c, visibleKeys), 0);
}

function maxDepth(columns: GridColumn_[], visibleKeys?: Set<string>): number {
  const visible = columns.filter((c) => isVisible(c, visibleKeys));
  if (!visible.length) return 0;
  return (
    1 +
    Math.max(0, ...visible.map((c) => (c.columns?.length ? maxDepth(c.columns, visibleKeys) : 0)))
  );
}

function minLeafOrder(column: GridColumn_, orderByKey: Map<string, number>): number {
  if (!column.columns?.length) return orderByKey.get(column.key) ?? Number.MAX_SAFE_INTEGER;
  return Math.min(...column.columns.map((c) => minLeafOrder(c, orderByKey)));
}

/**
 * Reorders a nested column tree to match `GridColumnState.order` (drag/move reorder), at EVERY
 * level: each group's own children are reordered among themselves (recursively), then the group
 * itself is positioned among its siblings by its minimum child order. The tree SHAPE never
 * changes — a leaf can move within its own group/level but can't jump into a different group —
 * so a leaf dragged to interleave with a sibling GROUP's leaves (crossing a group boundary) isn't
 * representable in a single header row/col-span rendering; that one case still falls back to
 * declaration order. Every other reorder (including the common case: no nested groups at all, or
 * moving a whole group / reordering leaves within one group) renders correctly. Ties (no
 * `columnState` entry, e.g. a column dropped mid-render) keep declaration order (stable sort).
 */
export function orderColumnsForHeader<RowType = any>(
  columns: GridColumn_<RowType>[],
  orderByKey: Map<string, number>,
): GridColumn_<RowType>[] {
  return columns
    .map((col, i) => ({
      col: col.columns?.length
        ? { ...col, columns: orderColumnsForHeader(col.columns, orderByKey) }
        : col,
      order: minLeafOrder(col, orderByKey),
      i,
    }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((entry) => entry.col);
}

/** Applies one leaf column's runtime `GridColumnState` override (width/pinned) onto its static
 *  config — the same override-wins-when-set rule `columnState` itself uses. Returns the same
 *  reference when nothing actually changed. */
export function applyColumnState<RowType = any>(
  column: GridColumn_<RowType>,
  state: GridColumnState | undefined,
): GridColumn_<RowType> {
  if (!state) return column;
  return state.width || state.pinned !== column.pinned
    ? { ...column, width: state.width ?? column.width, pinned: state.pinned }
    : column;
}

/**
 * Recursively applies `GridColumnState` overrides onto a column tree — the width/pinned analog
 * of `orderColumnsForHeader`'s order recursion. Only leaf columns ever carry a `GridColumnState`
 * entry (group/parent nodes never do), so a group node is rebuilt with just its children
 * recursed into.
 */
export function applyColumnOverrides<RowType = any>(
  columns: GridColumn_<RowType>[],
  stateByKey: Map<string, GridColumnState>,
): GridColumn_<RowType>[] {
  return columns.map((col) =>
    col.columns?.length
      ? { ...col, columns: applyColumnOverrides(col.columns, stateByKey) }
      : applyColumnState(col, stateByKey.get(col.key)),
  );
}

/**
 * Computes the rendered header matrix from a nested `GridColumn_` tree (COMPUTED output — see
 * `grid-header.interface.ts`). Leaf columns get `rowspan` stretching to the deepest row; group
 * columns get `colspan` equal to their (visible) leaf-descendant count. Pass `visibleKeys` (leaf
 * column keys currently visible per `GridColumnState`) to prune hidden leaves — and any group left
 * with zero visible descendants — from the matrix entirely.
 */
export function buildHeaderRows<RowType = any>(
  columns: GridColumn_<RowType>[],
  visibleKeys?: Set<string>,
): GridHeaderRow<RowType>[] {
  const depth = Math.max(1, maxDepth(columns, visibleKeys));
  const rows: GridHeaderRow<RowType>[] = Array.from({ length: depth }, () => ({ cells: [] }));

  const visit = (cols: GridColumn_<RowType>[], rowIndex: number): void => {
    for (const column of cols) {
      if (!isVisible(column, visibleKeys)) continue;
      const isLeaf = !column.columns?.length;
      const cell: GridHeaderCell<RowType> = {
        label: column.label ?? column.key,
        colspan: countLeaves(column, visibleKeys),
        rowspan: isLeaf ? depth - rowIndex : 1,
        column: isLeaf ? column : undefined,
        isLeaf,
      };
      rows[rowIndex].cells.push(cell);
      if (!isLeaf) visit(column.columns!, rowIndex + 1);
    }
  };
  visit(columns, 0);
  return rows;
}
