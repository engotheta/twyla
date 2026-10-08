import { inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { FieldType, FormParameter, observe, OptionsPage } from '@components/generic-form';
import { FetchService } from '@services/fetch';
import { applog } from '../../shared/applog';
import { DummyUser, DummyUsersResponse } from '../data-grid/data-grid-server.demo';
import { formResult } from './form-results.component';

// ─────────────────────────────────────────────
// Select fields whose options come from an API (generic-form SPEC §17), against dummyjson.com:
// loaded once, searched by the server, narrowed by fixed filters, pulled page by page, and
// fetched again when another field changes. Every request is written to the demo log, so what
// each select asks for can be read off the page.
// ─────────────────────────────────────────────

interface DummyCategory {
  slug: string;
  name: string;
}

interface DummyProduct {
  id: number;
  title: string;
}

interface DummyProductsResponse {
  products: DummyProduct[];
  total: number;
}

type Query = Record<string, string | number | null | undefined>;

/** `url?key=value…` as the demo log shows it, left readable: what has no value is not sent */
function describe(url: string, query: Query = {}): string {
  const sent = Object.entries(query).filter(([, value]) => value !== null && value !== undefined);
  const search = sent.map(([key, value]) => `${key}=${value}`).join('&');
  return search ? `GET ${url}?${search}` : `GET ${url}`;
}

const userPage = (res: DummyUsersResponse): OptionsPage<DummyUser> => ({
  content: res.users,
  totalLength: res.total,
});

const userOption = (user: DummyUser) => ({
  label: `${user.firstName} ${user.lastName}`,
  value: user.id,
});

/** Call from an injection context: it injects `FetchService`. */
export function getSelectFormParameter(): FormParameter<Record<string, unknown>> {
  const api = inject(FetchService);

  /** a GET through `FetchService`, logged; a page asked for again within a minute is not refetched */
  function get<Res, Data>(url: string, query: Query, resFn: (res: Res) => Data): Observable<Data> {
    applog.set(describe(url, query));
    return api.fetch$<Query, Res, Data>({
      url,
      method: 'GET',
      variables: query,
      resFn,
      cache: { policy: 'cache-first', ttl: 60_000 },
    });
  }

  return {
    title: 'Select options from an API',
    icon: 'cloud_sync',
    fieldsContainerClass: 'grid grid-cols-1 sm:grid-cols-2 gap-x-4',
    fieldsClass: 'mb-3',
    submitButtonLabel: 'Show value',
    submitButtonIcon: 'data_object',

    fields: [
      // ── API options: fetched once, mapped by labelKey / valueKey, searched in the browser ──
      {
        type: FieldType.select,
        key: 'category',
        label: 'Category',
        searchable: true,
        hasNoneOption: true,
        hint: 'API options: loaded once, searched in the browser',
        validations: [
          { name: 'required', validator: Validators.required, message: 'Pick a category' },
        ],
        optionsParameter: {
          labelKey: 'name',
          valueKey: 'slug',
          sortBy: 'name',
          optionsFunction: () =>
            get<DummyCategory[], DummyCategory[]>('products/categories', {}, (res) => res),
        },
      },

      // ── fetched on a form event: a new parameter each time Category changes ──
      {
        type: FieldType.select,
        key: 'product',
        label: 'Product',
        searchable: true,
        hint: 'Fetched again each time Category changes',
        disabled: observe('category', (category: string | null) => !category),
        // what was picked belongs to the category that was: it goes when the category does
        value: observe('category', () => null),
        optionsParameter: observe('category', (category: string | null) => ({
          labelKey: 'title',
          valueKey: 'id',
          filters: { category },
          optionsFunction: ({ filters }) =>
            filters['category']
              ? get<DummyProductsResponse, DummyProduct[]>(
                  `products/category/${filters['category']}`,
                  { select: 'title' },
                  (res) => res.products,
                )
              : [],
        })),
      },

      // ── API filter and pages: what is typed goes to the server, the list comes ten at a time ──
      {
        type: FieldType.select,
        key: 'owner',
        label: 'Owner',
        hint: 'Typing searches the server; scroll to the end for more',
        // a value from far down the list: its label is asked for by id
        value: 150,
        optionsParameter: {
          searchMode: 'server',
          paginated: true,
          pageSize: 10,
          mapper: userOption,
          optionsFunction: ({ search, page, size }) =>
            get<DummyUsersResponse, OptionsPage<DummyUser>>(
              'users/search',
              { q: search, limit: size, skip: (page - 1) * size, select: 'firstName,lastName' },
              userPage,
            ),
          selectedFunction: (ids: number[]) =>
            forkJoin(
              ids.map((id) =>
                get<DummyUser, DummyUser>(
                  `users/${id}`,
                  { select: 'firstName,lastName' },
                  (res) => res,
                ),
              ),
            ),
        },
      },

      // ── fixed filters: sent with every request, whatever page is asked for ──
      {
        type: FieldType.select,
        key: 'reviewers',
        label: 'Reviewers',
        multiple: true,
        searchable: true,
        hint: 'Fixed filter: women only, sent with every page',
        optionsParameter: {
          paginated: true,
          pageSize: 10,
          filters: { key: 'gender', value: 'female' },
          mapper: userOption,
          optionsFunction: ({ filters, page, size }) =>
            get<DummyUsersResponse, OptionsPage<DummyUser>>(
              'users/filter',
              {
                key: String(filters['key']),
                value: String(filters['value']),
                limit: size,
                skip: (page - 1) * size,
                select: 'firstName,lastName,gender',
              },
              userPage,
            ),
        },
      },

      // ── nothing is asked for until there is enough to search with ──
      {
        type: FieldType.select,
        key: 'approver',
        label: 'Approver',
        hint: 'Nothing is fetched until two letters are typed',
        optionsParameter: {
          searchMode: 'server',
          minSearchLength: 2,
          mapper: userOption,
          optionsFunction: ({ search }) =>
            get<DummyUsersResponse, DummyUser[]>(
              'users/search',
              { q: search, limit: 20, select: 'firstName,lastName' },
              (res) => res.users,
            ),
        },
      },
    ],

    onSubmit: (value) => formResult.set({ mode: 'submitted', value }),
  };
}
