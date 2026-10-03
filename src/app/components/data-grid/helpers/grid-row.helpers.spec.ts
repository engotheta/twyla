import { GridColumn_ } from '../interfaces/grid-column.interface';
import { SearchField } from '../interfaces/grid-search.interface';
import { matchesSearchFields } from './grid-row.helpers';

interface Row {
  name: string;
  city: string;
  age: number;
}

const columns: GridColumn_<Row>[] = [
  { key: 'name' },
  { key: 'city' },
  { key: 'age', type: 'number' },
];
const ada: Row = { name: 'Ada', city: 'NYC', age: 36 };

const like = (key: string | undefined, value: string): SearchField => ({
  key,
  value,
  searchType: 'like',
});

describe('matchesSearchFields — how entries combine', () => {
  it("defaults to 'or': a row matching any entry shows (the classic search fields)", () => {
    const fields = [like('name', 'ada'), like('city', 'chicago')];
    expect(matchesSearchFields(ada, fields, columns)).toBe(true);
    expect(matchesSearchFields(ada, fields, columns, 'or')).toBe(true);
  });

  it("'and': every entry must match (the unified search bar)", () => {
    expect(
      matchesSearchFields(ada, [like('name', 'ada'), like('city', 'chicago')], columns, 'and'),
    ).toBe(false);
    expect(
      matchesSearchFields(ada, [like('name', 'ada'), like('city', 'nyc')], columns, 'and'),
    ).toBe(true);
  });

  it("'and' combines free text (no key: any column) with a column entry", () => {
    expect(
      matchesSearchFields(ada, [like(undefined, 'nyc'), like('name', 'ada')], columns, 'and'),
    ).toBe(true);
    expect(
      matchesSearchFields(ada, [like(undefined, 'nyc'), like('name', 'bob')], columns, 'and'),
    ).toBe(false);
  });

  it("'and' takes two free-text entries as two words that must both appear somewhere", () => {
    expect(
      matchesSearchFields(ada, [like(undefined, 'ada'), like(undefined, 'nyc')], columns, 'and'),
    ).toBe(true);
    expect(
      matchesSearchFields(ada, [like(undefined, 'ada'), like(undefined, 'la')], columns, 'and'),
    ).toBe(false);
  });

  it('ignores entries with no value under either combination', () => {
    const fields = [like('name', ''), like('city', 'nyc')];
    expect(matchesSearchFields(ada, fields, columns, 'and')).toBe(true);
    expect(matchesSearchFields(ada, [like(undefined, '')], columns, 'and')).toBe(true);
  });

  it('still types a text value by the column before a strict compare', () => {
    const atLeast: SearchField = { key: 'age', value: '30', searchType: 'greaterThanOrEqual' };
    expect(matchesSearchFields(ada, [atLeast, like('name', 'ada')], columns, 'and')).toBe(true);
    expect(
      matchesSearchFields(ada, [{ ...atLeast, value: '40' }, like('name', 'ada')], columns, 'and'),
    ).toBe(false);
  });
});
