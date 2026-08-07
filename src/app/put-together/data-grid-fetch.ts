import { GridParameter } from '../components/data-grid';
import { from, map } from 'rxjs';

export const gridParameterFetch: GridParameter<any> = {
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
    let limit = page?.size ?? 10;
    let skip = page?.page ? (page.page - 1) * (page.size ?? 10) : 0;
    let url = `https://dummyjson.com/users/search?limit=${limit}&skip=${skip} `;

    if (page?.searchFields?.length) url += `&q=${page.searchFields[0].value ?? ''}`;
    if (page?.sort) url += `&sortBy=${page.sort.key}&order=${page.sort.direction}`;

    return from(fetch(url).then((res) => res.json())).pipe(
      map((res) => ({ content: res.users, totalLength: res.total })),
    );
  },
};
