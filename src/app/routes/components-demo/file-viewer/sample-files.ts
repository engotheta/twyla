// Sample files for the file-viewer demo, generated in the browser (jspdf, exceljs, JSZip, canvas)
// so the demo needs no fixtures — plus a few public URLs.

export { PUBLIC_PDF_URL } from '@configs/demo-file-paths';

export const PUBLIC_IMAGE_URL = 'https://picsum.photos/id/1018/2400/1600';
export const PUBLIC_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
// Apache POI's test files — public, so Office Online can fetch them
export const PUBLIC_PPTX_URL =
  'https://raw.githubusercontent.com/apache/poi/trunk/test-data/slideshow/SampleShow.pptx';
export const PUBLIC_DOC_URL =
  'https://raw.githubusercontent.com/apache/poi/trunk/test-data/document/SampleDoc.doc';
export const MISSING_URL =
  'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/no-such-file.pdf';

const LOREM =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. ' +
  'How vexingly quick daft zebras jump! Sphinx of black quartz, judge my vow. ';

/** A multi-page PDF with real text (searchable), optionally password-protected. */
export async function makePdf(password?: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF(
    password
      ? {
          encryption: {
            userPassword: password,
            ownerPassword: `${password}-owner`,
            userPermissions: ['print'],
          },
        }
      : {},
  );
  const pages = password ? 2 : 6;
  for (let p = 1; p <= pages; p++) {
    if (p > 1) doc.addPage();
    doc.setFontSize(22);
    doc.text(password ? `Confidential — page ${p}` : `Quarterly report — page ${p}`, 20, 30);
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(LOREM.repeat(8), 170), 20, 45);
    doc.setFillColor(37, 99, 235);
    doc.rect(20, 130, 40 + p * 15, 12, 'F');
    doc.text(`Revenue index ${p * 17}`, 20, 155);
    if (p === 1)
      doc.textWithLink('Open the pdf.js project', 20, 170, {
        url: 'https://mozilla.github.io/pdf.js/',
      });
  }
  return doc.output('blob');
}

/** A large image drawn on a canvas — as a Blob, or as raw base64 (no `data:` prefix). */
export async function makeChartImage(): Promise<Blob> {
  const canvas = drawChart();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas'))), 'image/png'),
  );
}

export function makeChartBase64(): string {
  return (drawChart(900, 560).toDataURL('image/png') ?? '').split(',')[1] ?? '';
}

function drawChart(width = 2000, height = 1250): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas; // no canvas support (jsdom in unit tests)
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#eff6ff');
  bg.addColorStop(1, '#dbeafe');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const bars = [62, 80, 45, 91, 70, 55, 98, 76];
  const bw = width / (bars.length * 1.6);
  bars.forEach((v, i) => {
    ctx.fillStyle = i % 2 ? '#2563eb' : '#1e40af';
    const h = (v / 100) * height * 0.7;
    ctx.fillRect(bw * 0.6 + i * bw * 1.6, height - h - height * 0.08, bw, h);
  });
  ctx.fillStyle = '#0f172a';
  ctx.font = `${Math.round(height / 14)}px sans-serif`;
  ctx.fillText('Monthly throughput', width * 0.05, height * 0.12);
  return canvas;
}

export function makeSvgDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#0f172a"/>
  <circle cx="180" cy="180" r="110" fill="#2563eb"/>
  <circle cx="320" cy="180" r="110" fill="#22c55e" fill-opacity=".8"/>
  <circle cx="460" cy="180" r="110" fill="#f59e0b" fill-opacity=".8"/>
  <text x="320" y="340" fill="#fff" font-family="sans-serif" font-size="22" text-anchor="middle">SVG from a data URL</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Two sheets: merged title, styled header, number / percent / date formats, a formula. */
export async function makeWorkbook(): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales');
  ws.columns = [
    { header: 'Region', key: 'region', width: 18 },
    { header: 'Units', key: 'units', width: 10 },
    { header: 'Revenue', key: 'revenue', width: 14 },
    { header: 'Margin', key: 'margin', width: 10 },
    { header: 'Closed', key: 'closed', width: 14 },
  ];
  ws.insertRow(1, ['Regional sales — Q3']);
  ws.mergeCells('A1:E1');
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  const header = ws.getRow(2);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell(
    (cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }),
  );
  const regions = [
    'Dar es Salaam',
    'Arusha',
    'Mwanza',
    'Dodoma',
    'Mbeya',
    'Tanga',
    'Morogoro',
    'Zanzibar',
  ];
  for (let i = 0; i < 240; i++) {
    const row = ws.addRow({
      region: regions[i % regions.length],
      units: 50 + ((i * 37) % 400),
      revenue: 1200.5 + ((i * 7919) % 90000) / 3,
      margin: ((i * 13) % 40) / 100,
      closed: new Date(Date.UTC(2026, 6, 1 + (i % 90))),
    });
    row.getCell('revenue').numFmt = '#,##0.00';
    row.getCell('margin').numFmt = '0%';
    row.getCell('closed').numFmt = 'yyyy-mm-dd';
  }
  const total = ws.addRow({ region: 'Total' });
  total.getCell('units').value = { formula: `SUM(B3:B${ws.rowCount - 1})`, result: 54321 };
  total.font = { bold: true };

  const notes = wb.addWorksheet('Notes');
  notes.addRow(['Prepared by', 'Finance']);
  notes.addRow(['Status', 'Draft — numbers are illustrative']);
  notes.getColumn(1).width = 16;
  notes.getColumn(2).width = 40;

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function makeCsv(): Blob {
  const rows = [['Code', 'Name', 'Population', 'Notes']];
  const names = ['Ilala', 'Kinondoni', 'Temeke', 'Ubungo', 'Kigamboni'];
  names.forEach((n, i) =>
    rows.push([
      `DSM-${i + 1}`,
      n,
      String(400000 + i * 125000),
      i === 2 ? 'Includes; "port" area' : '',
    ]),
  );
  const csv = rows
    .map((r) => r.map((v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';'))
    .join('\r\n');
  return new Blob([csv], { type: 'text/csv' });
}

export function makeJson(): Blob {
  const data = {
    id: 42,
    name: 'Studio',
    tags: ['viewer', 'files'],
    nested: { ok: true, count: 3 },
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** A minimal but real .docx — heading, paragraphs, a table and a link — zipped with JSZip. */
export async function makeDocx(): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://angular.dev" TargetMode="External"/>
</Relationships>`,
  );
  const p = (text: string, props = '') =>
    `<w:p><w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const cell = (text: string, bold = false) =>
    `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${p(text, bold ? '<w:b/>' : '')}</w:tc>`;
  const table = `<w:tbl><w:tblPr><w:tblBorders>
<w:top w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/>
<w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/>
<w:left w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/>
</w:tblBorders></w:tblPr>
<w:tr>${cell('Milestone', true)}${cell('Owner', true)}${cell('Due', true)}</w:tr>
<w:tr>${cell('Design review')}${cell('Asha')}${cell('12 Oct')}</w:tr>
<w:tr>${cell('Pilot launch')}${cell('Baraka')}${cell('3 Nov')}</w:tr></w:tbl>`;
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${p('Project charter', '<w:b/><w:sz w:val="40"/><w:color w:val="1E40AF"/>')}
${p(LOREM.repeat(3))}
${p('Milestones', '<w:b/><w:sz w:val="28"/>')}
${table}
${p(LOREM.repeat(2), '<w:i/>')}
<w:p><w:hyperlink r:id="rLink"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="1D4ED8"/></w:rPr><w:t>Read the Angular docs</w:t></w:r></w:hyperlink></w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`,
  );
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function makeZip(): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('readme.txt', 'Archives have no preview.');
  return zip.generateAsync({ type: 'blob' });
}

/** Two seconds of a 440 Hz tone as a 16-bit PCM WAV. */
export function makeWav(seconds = 2, hz = 440): Blob {
  const rate = 22050;
  const samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) =>
    [...text].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 2000, (samples - i) / 2000);
    view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * hz * i) / rate) * 0x3fff * fade, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Streams `blob` in small, slow chunks — so the progress bar has something to show. */
export function throttledStream(
  blob: Blob,
  chunk = 48 * 1024,
  delayMs = 70,
): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= blob.size) {
        controller.close();
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
      const part = new Uint8Array(await blob.slice(offset, offset + chunk).arrayBuffer());
      offset += chunk;
      controller.enqueue(part);
    },
  });
}
