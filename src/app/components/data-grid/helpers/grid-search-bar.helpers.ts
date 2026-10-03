// pure functions behind the unified search bar (SPEC.md §12): what it offers, what its list
// shows, and how what it holds maps to GridState.searchFields

import { FieldType, FormField, isObjectField, isStepField } from '@components/generic-form';
import { GridColumn_ } from '../interfaces/grid-column.interface';
import { GridFilterOperator } from '../interfaces/grid-filter.interface';
import {
  GridSearchBarItem,
  GridSearchOption,
  GridSearchSuggestion,
  GridSearchToken,
  GridSearchValueKind,
} from '../interfaces/grid-search-bar.interface';
import {
  DEFAULT_ENABLED_SEARCH_TYPES,
  GridSearchConfig,
  SearchField,
  SearchType,
} from '../interfaces/grid-search.interface';
import {
  GRID_SEARCH_COLUMN_OPERATORS,
  GRID_SEARCH_COLUMNS_GROUP,
  GRID_SEARCH_FILTERS_GROUP,
  GRID_SEARCH_OPERATORS,
  GRID_SEARCH_TEXT_OPTION,
  GRID_SEARCH_TEXT_VALUE,
  GRID_SEARCH_VALUELESS_OPERATORS,
} from './grid-search-bar.constants';

// ── what the bar offers ──

const BOOLEAN_OPTIONS: GridSearchOption[] = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

/** `SearchField.value` is a string whatever the column holds (`coerceSearchValue` types it
 *  before a compare), so a column token only ever asks for text — or Yes / No */
function columnValue(type: GridColumn_['type']): Pick<GridSearchToken, 'valueKind' | 'options'> {
  if (type === 'boolean') return { valueKind: 'options', options: BOOLEAN_OPTIONS };
  if (type === 'number' || type === 'currency' || type === 'percent')
    return { valueKind: 'number' };
  return { valueKind: 'text' };
}

/** one token per `searchable` column, in column order */
export function searchTokensFromColumns<RowType = any>(
  columns: GridColumn_<RowType>[],
  cfg: GridSearchConfig | undefined,
): GridSearchToken[] {
  const pickable = cfg?.searchTypeChangeable
    ? (cfg.enabledSearchTypes ?? DEFAULT_ENABLED_SEARCH_TYPES).filter((type) =>
        GRID_SEARCH_COLUMN_OPERATORS.has(type),
      )
    : [];

  return columns
    .filter((column) => column.searchable)
    .map((column) => {
      // same resolution order as the classic search fields (SPEC.md §5)
      const declared = column.searchType ?? cfg?.defaultSearchType ?? 'like';
      const defaultOperator = GRID_SEARCH_COLUMN_OPERATORS.has(declared) ? declared : 'like';
      return {
        id: `search:${column.key}`,
        source: 'search',
        key: column.key,
        title: column.label ?? column.key,
        icon: 'search',
        operators: pickable.includes(defaultOperator) ? pickable : [defaultOperator, ...pickable],
        defaultOperator,
        ...columnValue(column.type),
        available: true,
      } satisfies GridSearchToken;
    });
}

function filterValueKind(field: FormField): GridSearchValueKind | undefined {
  switch (field.type) {
    case FieldType.select:
      return 'options';
    case FieldType.checkbox:
    case FieldType.toggle:
    case FieldType.radio:
      return 'flag';
    case FieldType.input:
      return field.inputType === 'integer' || field.inputType === 'decimal' ? 'number' : 'text';
    case FieldType.textarea:
    case FieldType.richText:
    case FieldType.color:
      return 'text';
    case FieldType.date:
      switch (field.dateType ?? 'date') {
        case 'dateTime':
          return 'datetime';
        case 'time':
          return 'time';
        case 'monthYear':
          return 'month';
        case 'year':
          return 'year';
        default:
          return 'date';
      }
    default:
      return undefined; // object, attachment, step and the static types
  }
}

/**
 * The token for one `gridFilters` field, or undefined when the bar can't express it (a nested or
 * list field, an attachment, the `between` operator). `field` must be the field AS THE FORM
 * ENGINE CURRENTLY RESOLVES IT (`FormInstance.fieldState(field)()`), so `label` / `visible` /
 * `disabled` / `options` are plain values here; `loaded` are options an `optionsParameter`
 * fetched, when the field has one.
 */
export function filterTokenFromField(
  field: FormField,
  operator: GridFilterOperator,
  loaded?: GridSearchOption[],
): GridSearchToken | undefined {
  if (!field.key || ('isList' in field && field.isList)) return undefined;
  if (operator === 'between') return undefined;
  const kind = GRID_SEARCH_VALUELESS_OPERATORS.has(operator) ? 'flag' : filterValueKind(field);
  if (!kind) return undefined;

  const token: GridSearchToken = {
    id: `filter:${field.key}`,
    source: 'filter',
    key: field.key,
    title: typeof field.label === 'string' && field.label ? field.label : field.key,
    icon: typeof field.icon === 'string' && field.icon ? field.icon : 'filter_list',
    operators: [operator],
    defaultOperator: operator,
    valueKind: kind,
    available: field.visible !== false && field.disabled !== true,
  };

  if (kind === 'options' && field.type === FieldType.select) {
    const options = loaded ?? (Array.isArray(field.options) ? field.options : []);
    // a `hasNoneOption` / null entry means "no filter" — in the bar that's removing the token
    token.options = options
      .filter((option) => option.value !== null && option.value !== undefined)
      .map(({ value, label, icon, disabled }) => ({ value, label, icon, disabled }));
    token.multiple = field.multiple === true;
    token.compare = field.compareWith;
  }
  return token;
}

/**
 * Copies of `fields` (and of their nested `fields`), safe to hand to `FormEngineService.build`.
 * The engine writes resolved values over observed props (`visible: obs(…)`) on the very objects
 * it's given, so a second form built from the same objects finds plain values and nothing to
 * observe. Building from copies leaves the declared config intact for the next build.
 */
export function cloneFormFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const copy = { ...field } as FormField;
    if (isObjectField(copy) || isStepField(copy)) copy.fields = cloneFormFields(copy.fields);
    return copy;
  });
}

// ── values ──

/** what counts as "no value" for a filter — the same set `matchesFilters` ignores, plus `[]` */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** whether a control's value and a token's are the same thing: "no value" in any of its forms
 *  (null, '', false, []), dates by their time, lists element by element */
export function sameFilterValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => sameFilterValue(value, b[i]));
  }
  return false;
}

/** whether the token has a value part to edit — a `flag` is complete without one */
export function hasValuePart(token: GridSearchToken | undefined): boolean {
  return !token || token.valueKind !== 'flag';
}

/** a `flag` token's value: `true`, which is also what a checked toggle's control holds */
export function isItemComplete(
  item: GridSearchBarItem,
  token: GridSearchToken | undefined,
): boolean {
  if (!item.token) return String(item.value ?? '').trim() !== '';
  if (!token) return false;
  return token.valueKind === 'flag' ? item.value === true : !isEmptyValue(item.value);
}

const pad = (n: number, length = 2): string => String(n).padStart(length, '0');

/** the native input a value kind is typed into */
export function inputTypeFor(kind: GridSearchValueKind | undefined): string {
  switch (kind) {
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime-local';
    case 'time':
      return 'time';
    case 'month':
      return 'month';
    default:
      return 'text';
  }
}

/**
 * Typed text → the value the token holds. A column token keeps the text (see `columnValue`); a
 * filter token gets what the field's own control would hold in the filter panel — a number for a
 * numeric input, a local-time `Date` for a date (what the date picker gives). Returns `null` for
 * text that isn't a value yet (an empty box, a half-typed date).
 */
export function parseValue(token: GridSearchToken | undefined, text: string): unknown {
  if (!token || token.source === 'search') return text;
  const typed = text.trim();
  if (!typed) return null;

  switch (token.valueKind) {
    case 'number': {
      const n = Number(typed);
      return Number.isNaN(n) ? null : n;
    }
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typed);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    case 'datetime': {
      const date = new Date(typed);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    case 'month': {
      const m = /^(\d{4})-(\d{2})$/.exec(typed);
      return m ? new Date(+m[1], +m[2] - 1, 1) : null;
    }
    case 'year':
      return /^\d{4}$/.test(typed) ? new Date(+typed, 0, 1) : null;
    default:
      return text;
  }
}

/** the reverse of `parseValue`: what the input shows when a token's value is opened for editing */
export function inputText(token: GridSearchToken | undefined, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (!token) return String(value);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    switch (token.valueKind) {
      case 'datetime':
        return `${day}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
      case 'month':
        return day.slice(0, 7);
      case 'year':
        return day.slice(0, 4);
      default:
        return day;
    }
  }
  if (token.valueKind === 'options') return valueLabel(token, value);
  return String(value);
}

/** a date filter's value as its token shows it. Formatted here rather than through
 *  `formatCellValue`, which reads a `Date` instance as a plain object and returns nothing */
function dateLabel(value: unknown, options: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, options).format(date);
}

function optionLabel(token: GridSearchToken, value: unknown): string {
  const same = token.compare ?? ((a: unknown, b: unknown) => a === b);
  return token.options?.find((option) => same(option.value, value))?.label ?? String(value ?? '');
}

/** how a value reads on its token */
export function valueLabel(token: GridSearchToken | undefined, value: unknown): string {
  if (!token) return String(value ?? '');
  if (token.valueKind === 'flag') {
    return GRID_SEARCH_VALUELESS_OPERATORS.has(token.defaultOperator) ? '' : 'Yes';
  }
  if (isEmptyValue(value)) return '';

  switch (token.valueKind) {
    case 'options':
      return Array.isArray(value)
        ? value.map((v) => optionLabel(token, v)).join(', ')
        : optionLabel(token, value);
    case 'date':
      return dateLabel(value, { dateStyle: 'medium' });
    case 'datetime':
      return dateLabel(value, { dateStyle: 'medium', timeStyle: 'short' });
    case 'month':
      return dateLabel(value, { month: 'long', year: 'numeric' });
    case 'year':
      return value instanceof Date ? String(value.getFullYear()) : String(value);
    default:
      return String(value);
  }
}

/** the token said in full — its accessible name, and what the status line announces */
export function itemLabel(item: GridSearchBarItem, token: GridSearchToken | undefined): string {
  if (!item.token) return `Text: ${String(item.value ?? '')}`;
  if (!token) return '';
  const operator = GRID_SEARCH_OPERATORS[item.operator ?? token.defaultOperator];
  return [token.title, operator.words, valueLabel(token, item.value)].filter(Boolean).join(' ');
}

// ── the list ──

/** GitLab's matcher: a case-insensitive "contains" */
export function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * The field list under the text input: every offered field whose title contains `query`, under
 * "Columns" / "Filters" headings when the grid has both kinds, then — when free text is allowed
 * and something is typed — the row that turns the text into a pill. `used` are the token ids
 * already in the bar: one token per column or filter.
 */
export function fieldSuggestions(
  tokens: GridSearchToken[],
  used: ReadonlySet<string>,
  query: string,
  freeText: boolean,
): GridSearchSuggestion[] {
  const grouped =
    tokens.some((token) => token.source === 'search') &&
    tokens.some((token) => token.source === 'filter');

  const rows: GridSearchSuggestion[] = tokens
    .filter((token) => token.available && !used.has(token.id) && matchesQuery(token.title, query))
    .map((token) => ({
      value: token.id,
      label: token.title,
      icon: token.icon,
      group: !grouped
        ? undefined
        : token.source === 'search'
          ? GRID_SEARCH_COLUMNS_GROUP
          : GRID_SEARCH_FILTERS_GROUP,
    }));

  if (freeText && query.trim()) {
    rows.push({ value: GRID_SEARCH_TEXT_VALUE, label: GRID_SEARCH_TEXT_OPTION, icon: 'title' });
  }
  return rows;
}

/** a token's operator list: the symbol or words it shows, then what a symbol means */
export function operatorSuggestions(token: GridSearchToken): GridSearchSuggestion[] {
  return token.operators.map((operator) => {
    const { text, words } = GRID_SEARCH_OPERATORS[operator];
    return { value: operator, label: text, description: words === text ? undefined : words };
  });
}

/** a list-valued token's options — narrowed by `query` once the user has typed something */
export function valueSuggestions(
  token: GridSearchToken,
  query: string,
  typed: boolean,
): GridSearchSuggestion[] {
  return (token.options ?? [])
    .filter((option) => !typed || matchesQuery(option.label, query))
    .map(({ value, label, icon, disabled }) => ({ value, label, icon, disabled }));
}

/**
 * Which row starts highlighted — GitLab's rule (`defaultSuggestedValue`): with text typed, the
 * row whose label IS the text, else the first whose label contains it, else the free-text row
 * when there is one; with nothing typed, `fallback`. `undefined` highlights nothing, and Enter
 * then submits instead of taking a row.
 */
export function suggestedValue(
  rows: GridSearchSuggestion[],
  query: string,
  fallback?: unknown,
): unknown {
  const typed = query.trim().toLowerCase();
  if (!typed) return fallback;

  const fields = rows.filter((row) => !row.disabled && row.value !== GRID_SEARCH_TEXT_VALUE);
  const match =
    fields.find((row) => row.label.toLowerCase() === typed) ??
    fields.find((row) => matchesQuery(row.label, typed));
  if (match) return match.value;
  return rows.some((row) => row.value === GRID_SEARCH_TEXT_VALUE)
    ? GRID_SEARCH_TEXT_VALUE
    : undefined;
}

// ── to and from GridState.searchFields ──

/**
 * `GridState.searchFields` for what the bar holds: its free text first (one keyless entry per
 * text pill, then the text still in the input), then one entry per column token that has a
 * value. Never empty — an empty bar is one keyless entry with an empty value, which keeps the
 * "always at least one entry" contract `PageDetails.searchFields` documents.
 */
export function toSearchFields(
  items: GridSearchBarItem[],
  tokens: ReadonlyMap<string, GridSearchToken>,
  text: string,
  defaultType: SearchType = 'like',
): SearchField[] {
  const free: SearchField[] = [];
  const keyed: SearchField[] = [];

  for (const item of items) {
    if (!item.token) {
      const value = String(item.value ?? '').trim();
      if (value) free.push({ key: undefined, value, searchType: defaultType });
      continue;
    }
    const token = tokens.get(item.token);
    if (token?.source !== 'search' || isEmptyValue(item.value)) continue;
    keyed.push({
      key: token.key,
      value: String(item.value),
      searchType: item.operator ?? token.defaultOperator,
    });
  }

  const typed = text.trim();
  if (typed) free.push({ key: undefined, value: typed, searchType: defaultType });

  const fields = [...free, ...keyed];
  return fields.length ? fields : [{ key: undefined, value: '', searchType: defaultType }];
}

/**
 * The reverse, for seeding the bar and for following a `setSearchFields` made from code: a
 * keyless entry becomes a text pill, a keyed one its column's token. Entries with no value, or
 * for a column the bar doesn't offer, are skipped.
 */
export function searchItemsFromFields(
  fields: SearchField[],
  tokens: ReadonlyMap<string, GridSearchToken>,
): Omit<GridSearchBarItem, 'id'>[] {
  const items: Omit<GridSearchBarItem, 'id'>[] = [];
  for (const field of fields) {
    if (field.value === undefined || field.value === null || field.value === '') continue;
    if (field.key === undefined) {
      items.push({ value: field.value });
      continue;
    }
    const token = tokens.get(`search:${field.key}`);
    if (!token) continue;
    // the entry's own searchType is kept even when the token wouldn't offer it — the bar shows
    // what the grid is actually searching by
    items.push({ token: token.id, operator: field.searchType, value: field.value });
  }
  return items;
}
