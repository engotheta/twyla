import { firstValueFrom, of } from 'rxjs';
import { FormState } from '../../interfaces/form-state.interface';
import {
  DEFAULT_OPTIONS_PAGE_SIZE,
  hasMoreOptions,
  mapRawOptions,
  mergeOptions,
  optionsRequest,
  resolveOptionsSource,
  toOptionsPage,
} from './options.helpers';

const formState = { value: { country: 'tz' } } as unknown as FormState;

describe('resolveOptionsSource', () => {
  it('takes a value, a Promise or an Observable', async () => {
    expect(await firstValueFrom(resolveOptionsSource(() => [1]))).toEqual([1]);
    expect(await firstValueFrom(resolveOptionsSource(() => Promise.resolve([2])))).toEqual([2]);
    expect(await firstValueFrom(resolveOptionsSource(() => of([3])))).toEqual([3]);
  });

  it('runs the function when subscribed to, and fails with what it throws', async () => {
    const fn = vi.fn((): number[] => {
      throw new Error('offline');
    });
    const source$ = resolveOptionsSource(fn);
    expect(fn).not.toHaveBeenCalled();
    await expect(firstValueFrom(source$)).rejects.toThrow('offline');
  });
});

describe('mapRawOptions', () => {
  const raw = [
    { id: 2, name: 'Beta' },
    { id: 1, name: 'Alpha' },
  ];

  it('maps by labelKey / valueKey, sorting first when asked', () => {
    expect(mapRawOptions(raw, { labelKey: 'name', valueKey: 'id', sortBy: 'name' })).toEqual([
      { label: 'Alpha', value: 1 },
      { label: 'Beta', value: 2 },
    ]);
  });

  it('maps through a mapper function', () => {
    const options = mapRawOptions(raw, {
      mapper: (item) => ({ label: `#${item.id}`, value: item }),
    });
    expect(options.map((option) => option.label)).toEqual(['#2', '#1']);
  });
});

describe('optionsRequest', () => {
  it('asks for the first page of everything, with the defaults', () => {
    expect(optionsRequest({}, formState)).toEqual({
      search: '',
      page: 1,
      size: DEFAULT_OPTIONS_PAGE_SIZE,
      filters: {},
      formState,
    });
  });

  it('carries the fixed filters and the page size of its parameter', () => {
    const request = optionsRequest({ filters: { active: true }, pageSize: 10 }, formState, 'ab', 3);
    expect(request).toMatchObject({ search: 'ab', page: 3, size: 10, filters: { active: true } });
  });
});

describe('toOptionsPage', () => {
  it('takes a bare array for a page that says nothing of what follows', () => {
    expect(toOptionsPage([1, 2])).toEqual({ content: [1, 2] });
  });

  it('keeps what a page says, and stands in for content that is missing', () => {
    expect(toOptionsPage({ content: [1], totalLength: 9 })).toEqual({
      content: [1],
      totalLength: 9,
    });
    expect(toOptionsPage({ totalLength: 0 } as never)).toEqual({ content: [], totalLength: 0 });
    expect(toOptionsPage(undefined)).toEqual({ content: [] });
  });
});

describe('hasMoreOptions', () => {
  it('goes by hasMore first', () => {
    expect(hasMoreOptions({ content: [1], hasMore: true, totalLength: 1 }, 1, 25)).toBe(true);
    expect(hasMoreOptions({ content: [1, 2], hasMore: false }, 2, 2)).toBe(false);
  });

  it('then by the total against what is loaded', () => {
    expect(hasMoreOptions({ content: [1, 2], totalLength: 5 }, 2, 2)).toBe(true);
    expect(hasMoreOptions({ content: [5], totalLength: 5 }, 5, 2)).toBe(false);
  });

  it('else by whether the page came back full', () => {
    expect(hasMoreOptions({ content: [1, 2] }, 2, 2)).toBe(true);
    expect(hasMoreOptions({ content: [1] }, 3, 2)).toBe(false);
    expect(hasMoreOptions({ content: [] }, 0, 0)).toBe(false);
  });
});

describe('mergeOptions', () => {
  const a = { label: 'A', value: 1 };
  const b = { label: 'B', value: 2 };

  it('appends what is new, leaving out values already held', () => {
    expect(mergeOptions([a], [{ label: 'A again', value: 1 }, b])).toEqual([a, b]);
  });

  it('returns the same list when nothing is new', () => {
    const held = [a, b];
    expect(mergeOptions(held, [b])).toBe(held);
  });

  it('tells values apart the way the field does', () => {
    const one = { label: 'One', value: { id: 1 } };
    const sameId = (x: { id: number }, y: { id: number }) => x.id === y.id;
    expect(mergeOptions([one], [{ label: 'Uno', value: { id: 1 } }], sameId)).toEqual([one]);
  });
});
