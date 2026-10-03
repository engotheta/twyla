import { RGB_COLORS } from './color.constants';

export function getColorName(hexColor: string) {
  // Remove the "#" symbol if it's included in the input
  hexColor = hexColor.replace('#', '');

  // Convert the hex color code to RGB format
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);

  let colorName = null;
  let distance = Number.POSITIVE_INFINITY;

  // Find the closest color name in the library
  for (const color in RGB_COLORS) {
    const [r_, g_, b_] = (<any>RGB_COLORS)[color];
    const d = Math.sqrt((r - r_) ** 2 + (g - g_) ** 2 + (b - b_) ** 2);
    if (d < distance && (distance = d)) colorName = color;
  }

  return colorName;
}

export function getColorCode(name: string, format = 'hex') {
  if (typeof name !== 'string') return '';
  // variables to store the closest color and its distance
  let colorCode = null;
  let distance = Number.POSITIVE_INFINITY;

  // Assign color as according to the closest Levenshtein distance
  for (const color in RGB_COLORS) {
    const d = getLevenshteinDistance(name.toLowerCase(), color.toLowerCase());
    if (d < distance && (distance = d)) colorCode = rgbToHex((<any>RGB_COLORS)[color]);
  }

  return colorCode;
}

export function rgbToHex([r, g, b]: any) {
  // Ensure that the values are within the valid range (0-255)
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  // Convert each component to its hexadecimal representation
  const hexR = r.toString(16).padStart(2, '0');
  const hexG = g.toString(16).padStart(2, '0');
  const hexB = b.toString(16).padStart(2, '0');

  // Combine the hexadecimal values
  return `#${hexR}${hexG}${hexB}`;
}

export function fmtSpecialCharsToHtml(text: string) {
  return text.replace(/\n/g, '<br>');
}

export function hexToRgb(hexColor: string) {
  if (typeof hexColor !== 'string') return hexColor;
  // Remove the hash if present
  hexColor = hexColor.replace(/^#/, '');

  // Convert hex to RGB
  const bigint = parseInt(hexColor, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

export function getContrastGray(hexColor: string) {
  if (typeof hexColor !== 'string') return '#000000';
  // Calculate luminance
  const calculateLuminance = (rgb: any) => {
    const [r, g, b] = rgb.map((value: any) => {
      value /= 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Get RGB from hex // Calculate luminance
  const rgb = hexToRgb(hexColor);
  const luminance = calculateLuminance(rgb);
  // Decide on the contrasting color
  const contrastColor = luminance > 0.5 ? '#000000' : '#ffffff';
  return contrastColor;
}

export function getContrastColor(hexColor: string) {
  // Remove the hash if present
  const cleanHex = hexColor.replace(/^#/, '');

  // Invert each channel and convert back to hex
  const invertedColor = cleanHex
    ?.match(/.{1,2}/g) // Split into pairs
    ?.map((channel: any) => {
      const invertedValue = 255 - parseInt(channel, 16);
      return invertedValue.toString(16).padStart(2, '0'); // Convert back to hex
    })
    .join('');

  return `#${invertedColor}`;
}

export function getLevenshteinDistance(a: string, b: string) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const mat = [];
  for (let i = 0; i <= b.length; i++) mat[i] = [i];
  for (let j = 0; j <= a.length; j++) mat[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) mat[i][j] = mat[i - 1][j - 1];
      else mat[i][j] = Math.min(mat[i - 1][j - 1] + 1, mat[i][j - 1] + 1, mat[i - 1][j] + 1);
    }
  }

  return mat[b.length][a.length];
}
