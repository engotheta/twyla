import { inject } from '@angular/core';
import { GridParameter } from '../components/data-grid';
import { FetchService } from '../services/fetch';

/** The dummyjson.com user fields the fetch demos use. */
export interface DummyUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  maidenName?: string;
  age?: number;
  gender?: string;
  image?: string;
  userAgent?: string;
}

export interface DummyUsersResponse {
  users: DummyUser[];
  total: number;
}

/**
 * Server-paginated users grid backed by `FetchService` — slugs resolve against the
 * `provideFetchConfig` base url in app.config. Call from an injection context.
 */
export function getGridParameterFetch(): GridParameter<DummyUser> {
  const api = inject(FetchService);

  return {
    canAddColumns: true,
    lastDotAsName: true,
    export: { formats: ['excel', 'pdf'] },
    columns: [
      'firstName',
      'lastName',
      'maidenName',
      'image type(imageUrl) imageClass(w-[40px] h-[40px] )',
      'age',
      'userAgent',
      'gender',
    ],

    fetchFn: (page) => {
      const size = page?.size ?? 10;

      return api.fetch$({
        url: 'users/search',
        method: 'GET',
        variables: {
          limit: size,
          skip: page?.page ? (page.page - 1) * size : 0,
          q: page?.searchFields?.[0]?.value ?? '',
          sortBy: page?.sort?.key,
          order: page?.sort?.direction,
        },
        resFn: (res: DummyUsersResponse) => ({ content: res.users, totalLength: res.total }),
        // revisiting a page within a minute is instant; fast paging cancels stale requests
        cache: { policy: 'cache-first', ttl: 60_000 },
        concurrency: 'switch',
      });
    },
  };
}
