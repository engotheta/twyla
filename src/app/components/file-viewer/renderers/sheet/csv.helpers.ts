const CANDIDATES = [',', ';', '\t', '|'] as const;

export interface CsvResult {
  rows: string[][];
  /** stopped at `maxRows` */
  truncated: boolean;
}

/**
 * RFC 4180 CSV: quoted fields, `""` escapes, delimiters and line breaks inside quotes, CRLF / LF /
 * CR line endings. A leading BOM is dropped, a trailing empty line ignored.
 */
export function parseCsv(text: string, delimiter = ',', maxRows = Infinity): CsvResult {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = (): boolean => {
    endField();
    rows.push(row);
    row = [];
    return rows.length >= maxRows;
  };

  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
    } else if (ch === delimiter) {
      endField();
      i++;
    } else if (ch === '\r' || ch === '\n') {
      i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1;
      if (endRow()) return { rows, truncated: i < src.length };
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== '' || row.length) endRow();
  return { rows, truncated: false };
}

/**
 * Guesses the delimiter: the candidate that splits the first lines into the most consistent number
 * of fields (more than one). Falls back to a comma.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  let best: { delimiter: string; score: number } = { delimiter: ',', score: 0 };

  for (const delimiter of CANDIDATES) {
    const { rows } = parseCsv(sample, delimiter, 20);
    const counts = rows.filter((r) => r.length > 1 || r[0] !== '').map((r) => r.length);
    if (!counts.length) continue;
    const mode = modeOf(counts);
    if (mode < 2) continue;
    const consistent = counts.filter((c) => c === mode).length / counts.length;
    const score = consistent * 100 + Math.min(mode, 50);
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

function modeOf(values: number[]): number {
  const tally = new Map<number, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  let mode = values[0];
  for (const [value, count] of tally) if (count > (tally.get(mode) ?? 0)) mode = value;
  return mode;
}
