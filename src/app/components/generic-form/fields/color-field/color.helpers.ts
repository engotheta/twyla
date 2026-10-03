import { ColorField } from '../../interfaces/control-fields.interface';

type ColorFormat = NonNullable<ColorField['colorFormat']>;
interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToRgb(hex: string): Rgb {
  const match = HEX_RE.exec(hex.trim());
  const full = match ? (match[1].length === 3 ? expandShortHex(match[1]) : match[1]) : '000000';
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function expandShortHex(hex3: string): string {
  return hex3
    .split('')
    .map((c) => c + c)
    .join('');
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const [rp, gp, bp] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}

function rgbToHsv({ r, g, b }: Rgb): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToRgb({ h, s, v }: { h: number; s: number; v: number }): Rgb {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  const [rp, gp, bp] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}

const NUMBERS_RE = /-?\d+(\.\d+)?/g;

function parseNumbers(value: string): number[] {
  return (value.match(NUMBERS_RE) ?? []).map(Number);
}

/** Converts any format the control might hold into a `#rrggbb` hex for the native color input. */
export function toHex(value: string | null | undefined, format: ColorFormat): string {
  if (!value) return '#000000';
  if (format === 'hex') return HEX_RE.test(value.trim()) ? normalizeHex(value) : '#000000';

  const [a, b, c] = parseNumbers(value);
  if (a === undefined) return '#000000';
  if (format === 'rgb') return rgbToHex({ r: a, g: b, b: c } as Rgb);
  if (format === 'hsl') return rgbToHex(hslToRgb({ h: a, s: b, l: c }));
  return rgbToHex(hsvToRgb({ h: a, s: b, v: c })); // 'hsv'
}

function normalizeHex(hex: string): string {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return '#000000';
  return `#${match[1].length === 3 ? expandShortHex(match[1]) : match[1]}`.toLowerCase();
}

/** Converts a `#rrggbb` hex (from the native color input) into the field's configured format. */
export function fromHex(hex: string, format: ColorFormat): string {
  if (format === 'hex') return hex;
  const rgb = hexToRgb(hex);
  if (format === 'rgb') return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(rgb);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  const { h, s, v } = rgbToHsv(rgb);
  return `hsv(${h}, ${s}%, ${v}%)`; // 'hsv'
}
