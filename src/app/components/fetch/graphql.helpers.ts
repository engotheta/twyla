import { HttpErrorResponse } from '@angular/common/http';
import { isRecord } from './fetch.helpers';
import { GraphqlDocument } from './fetch.interface';

/** A GraphQL-over-HTTP response body. */
export interface GraphqlResponse {
  data?: Record<string, unknown> | null;
  errors?: readonly { message: string }[];
}

/** Indexes of a `{` and its matching `}`. */
interface Span {
  start: number;
  end: number;
}

interface SelectionTree extends Map<string, SelectionTree> {}

/** The text of a query or mutation — `gql` documents keep it in `loc.source.body`. */
export function graphqlSource(document: GraphqlDocument | string | undefined): string {
  if (typeof document === 'string') return document;

  const body = document?.loc?.source?.body;
  if (!body) {
    throw new Error(
      'GraphQL document has no source text (loc.source.body): pass the query as a string, ' +
        'or build it with gql.',
    );
  }
  return body;
}

/** `['id', 'data.name', 'data.owner.email']` → `id data { name owner { email } }`. */
export function toSelectionSet(fields: readonly string[]): string {
  const root: SelectionTree = new Map();

  for (const field of fields) {
    let node = root;
    for (const part of field.split('.').map((p) => p.trim()).filter(Boolean)) {
      let child = node.get(part);
      if (!child) {
        child = new Map();
        node.set(part, child);
      }
      node = child;
    }
  }

  return renderSelection(root);
}

function renderSelection(tree: SelectionTree): string {
  return [...tree]
    .map(([name, children]) => (children.size ? `${name} { ${renderSelection(children)} }` : name))
    .join(' ');
}

/**
 * Replaces the selection set of the operation's first root field with `fields` (see
 * `toSelectionSet`). Braces inside strings, comments and argument lists are ignored, and
 * fragment definitions ahead of the operation are skipped.
 */
export function applyFieldSelection(source: string, fields: readonly string[]): string {
  let from = 0;
  let operation = findSelectionSet(source, from);
  while (operation && /^\s*fragment\b/.test(stripComments(source.slice(from, operation.start)))) {
    from = operation.end + 1;
    operation = findSelectionSet(source, from);
  }
  if (!operation) return source;

  const selection = ` ${toSelectionSet(fields)} `;
  const field = findSelectionSet(source, operation.start + 1, operation.end);

  // a root field without a selection set yet: give it one
  if (!field) {
    return `${source.slice(0, operation.end).trimEnd()} {${selection}} ${source.slice(operation.end)}`;
  }

  return `${source.slice(0, field.start + 1)}${selection}${source.slice(field.end)}`;
}

/** First top-level `{ … }` within `source[from, to)`, skipping strings, comments and `( … )`. */
function findSelectionSet(source: string, from: number, to = source.length): Span | undefined {
  let start = -1;
  let depth = 0;
  let parens = 0;

  for (let i = from; i < to; i++) {
    const char = source[i];

    if (char === '#') i = lineEnd(source, i);
    else if (char === '"') i = stringEnd(source, i);
    else if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (parens > 0) continue;
    else if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start >= 0) return { start, end: i };
      if (depth < 0) return undefined; // walked out of the enclosing set without finding one
    }
  }
  return undefined;
}

/** Index of the closing quote of the string starting at `i` (handles `"""block"""` strings). */
function stringEnd(source: string, i: number): number {
  if (source.startsWith('"""', i)) {
    const end = source.indexOf('"""', i + 3);
    return end < 0 ? source.length : end + 2;
  }
  for (let j = i + 1; j < source.length; j++) {
    if (source[j] === '\\') j++;
    else if (source[j] === '"') return j;
  }
  return source.length;
}

function lineEnd(source: string, i: number): number {
  const end = source.indexOf('\n', i);
  return end < 0 ? source.length : end;
}

function stripComments(source: string): string {
  return source.replace(/#[^\n]*/g, '');
}

/**
 * Unwraps `{ data: { rootField: value } }` to `value` (or to `data` when there are several root
 * fields). A response with `errors` throws an `HttpErrorResponse` carrying their messages.
 */
export function unwrapGraphqlResponse<T>(body: GraphqlResponse | null, url: string): T {
  if (body?.errors?.length) {
    const message = body.errors.map((error) => error.message).join('; ');
    throw new HttpErrorResponse({
      error: { ...body, message },
      status: 200,
      statusText: 'GraphQL error',
      url,
    });
  }

  const data = body?.data;
  const keys = isRecord(data) ? Object.keys(data) : [];
  return (isRecord(data) && keys.length === 1 ? data[keys[0]] : data) as T;
}
