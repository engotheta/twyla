import { detectDelimiter, parseCsv } from './csv.helpers';

describe('csv helpers', () => {
  it('parses RFC 4180: quotes, escaped quotes, delimiters and line breaks inside quotes', () => {
    const csv = 'name,note\r\n"Ada","said ""hi"", twice"\r\n"Grace","line one\nline two"\r\n';
    expect(parseCsv(csv).rows).toEqual([
      ['name', 'note'],
      ['Ada', 'said "hi", twice'],
      ['Grace', 'line one\nline two'],
    ]);
  });

  it('handles BOMs, bare CR line endings, empty fields and a missing final newline', () => {
    expect(parseCsv('﻿a,b\rc,\r,d').rows).toEqual([
      ['a', 'b'],
      ['c', ''],
      ['', 'd'],
    ]);
  });

  it('stops at maxRows and says so', () => {
    const { rows, truncated } = parseCsv('1\n2\n3\n4\n', ',', 2);
    expect(rows).toEqual([['1'], ['2']]);
    expect(truncated).toBe(true);
    expect(parseCsv('1\n2\n', ',', 2).truncated).toBe(false);
  });

  it('detects the delimiter from how consistently it splits the lines', () => {
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('city,note\nDar,"a; b; c"\nMoshi,x')).toBe(',');
    expect(detectDelimiter('just one column\nsecond line')).toBe(',');
  });
});
