import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DEFAULT_FETCH_CONFIG } from './fetch-config.token';
import {
  appendQueryParams,
  defaultResFn,
  httpErrorMessage,
  resolveUrl,
  stableStringify,
} from './fetch.helpers';
import { applyFieldSelection, toSelectionSet, unwrapGraphqlResponse } from './graphql.helpers';

const messages = DEFAULT_FETCH_CONFIG.messages;

describe('fetch helpers', () => {
  it('stableStringify ignores key order at every depth', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [{ f: 1, e: 2 }] } })).toBe(
      stableStringify({ a: { c: [{ e: 2, f: 1 }], d: 2 }, b: 1 }),
    );
    expect(stableStringify(undefined)).toBe('');
  });

  it('resolveUrl joins slugs to the base and leaves absolute urls alone', () => {
    expect(resolveUrl('https://api.test/', '/users')).toBe('https://api.test/users');
    expect(resolveUrl('https://api.test', 'users')).toBe('https://api.test/users');
    expect(resolveUrl('https://api.test', 'https://other.test/x')).toBe('https://other.test/x');
    expect(resolveUrl('https://api.test', '//cdn.test/x')).toBe('//cdn.test/x');
    expect(resolveUrl('', 'users')).toBe('users');
  });

  it('appendQueryParams skips empty values, repeats arrays and serialises dates and objects', () => {
    const date = new Date(Date.UTC(2026, 0, 2));
    const params = appendQueryParams(new HttpParams(), {
      q: 'ada',
      skip: undefined,
      none: null,
      ids: [1, 2],
      from: date,
      filter: { active: true },
    });

    expect(params.get('q')).toBe('ada');
    expect(params.has('skip')).toBe(false);
    expect(params.has('none')).toBe(false);
    expect(params.getAll('ids')).toEqual(['1', '2']);
    expect(params.get('from')).toBe(date.toISOString());
    expect(params.get('filter')).toBe('{"active":true}');
  });

  it('defaultResFn unwraps `data` only when it is there', () => {
    expect(defaultResFn({ data: [1], success: true })).toEqual([1]);
    expect(defaultResFn({ data: null, message: 'x' })).toEqual({ data: null, message: 'x' });
    expect(defaultResFn([1, 2])).toEqual([1, 2]);
  });

  it("httpErrorMessage prefers the server's words, then a network message", () => {
    const withBody = new HttpErrorResponse({ status: 400, error: { error_description: 'Bad token' } });
    const offline = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    const htmlPage = new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' });

    expect(httpErrorMessage(withBody, messages)).toBe('Bad token');
    expect(httpErrorMessage(offline, messages)).toBe(messages.network);
    expect(httpErrorMessage(htmlPage, messages)).toBe(messages.error);
  });
});

describe('graphql helpers', () => {
  it('toSelectionSet nests dotted paths', () => {
    expect(toSelectionSet(['id', 'data.name', 'data.owner.email'])).toBe(
      'id data { name owner { email } }',
    );
  });

  it('applyFieldSelection replaces the root field selection, ignoring braces in args, strings and comments', () => {
    const source = `
      # a { brace in a comment
      query Users($filter: Filter = { active: true }) {
        users(filter: $filter, note: "a } brace") { id oldField }
      }`;
    const result = applyFieldSelection(source, ['id', 'name']);

    expect(result).toContain('users(filter: $filter, note: "a } brace") { id name }');
    expect(result).not.toContain('oldField');
  });

  it('applyFieldSelection skips fragment definitions ahead of the operation', () => {
    const source = 'fragment F on User { id }\nquery { me { ...F } }';
    expect(applyFieldSelection(source, ['name'])).toBe(
      'fragment F on User { id }\nquery { me { name } }',
    );
  });

  it('applyFieldSelection gives a bare root field a selection set', () => {
    expect(applyFieldSelection('mutation { save }', ['id'])).toBe('mutation { save { id } }');
  });

  it('unwrapGraphqlResponse returns the single root field, or throws on errors', () => {
    expect(unwrapGraphqlResponse({ data: { users: [1] } }, '/graphql')).toEqual([1]);
    expect(unwrapGraphqlResponse({ data: { a: 1, b: 2 } }, '/graphql')).toEqual({ a: 1, b: 2 });
    expect(() => unwrapGraphqlResponse({ errors: [{ message: 'Denied' }] }, '/graphql')).toThrow(
      HttpErrorResponse,
    );
  });
});
