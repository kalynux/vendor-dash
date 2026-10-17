/**
 * A real Excel workbook (.xlsx) for the export buttons.
 *
 * ⚠ Why not CSV, which is what this used to write: a CSV has no way to say which
 * character separates its columns, and Excel does not look — it uses the list
 * separator from the computer's regional settings. A French Windows expects `;`,
 * an English one `,`, and a file written with the other opens as **one long
 * column**. Picking the separator from the app's language was a guess about the
 * vendor's computer, and it was wrong for anyone who reads the dashboard in
 * French on an English machine (or the reverse).
 *
 * A workbook has columns built in, so there is nothing to guess. It also lets the
 * file arrive tidy: columns as wide as their content, titles in bold, amounts as
 * real numbers and dates as real dates, so sorting and totals just work.
 *
 * A workbook is a zip of a few small XML files. Both halves are written here —
 * there is no spreadsheet library in the bundle, and one would cost far more
 * than the ~200 lines below.
 */

export type SheetCell = string | number | Date | null | undefined;

export interface Sheet {
  /** The tab's label at the bottom of the window. */
  name: string;
  rows: SheetCell[][];
  /** Indexes into `rows` of the column-title rows, written in bold. */
  headerRows?: number[];
  /**
   * One table with its titles on the first row: that row stays in view while
   * scrolling and each column gets a filter arrow.
   */
  table?: boolean;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Indexes into `<cellXfs>` in {@link STYLES_XML}. */
const STYLE = { plain: 0, header: 1, integer: 2, decimal: 3, dateTime: 4 } as const;

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const CONTENT_TYPES_XML =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>';

const WORKBOOK_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId3" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
  '</Relationships>';

/**
 * Number formats 3 and 4 are Excel's own `#,##0` and `#,##0.00`: the reader's
 * computer supplies the thousands and decimal marks, so 76000 shows as "76,000"
 * on an English setup and "76 000" on a French one. The date format is spelled
 * out instead — year first reads the same everywhere, where a built-in one
 * would flip between 05/10 and 10/05.
 */
const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/**
 * Escape text for XML, dropping the characters XML cannot carry at all.
 *
 * ⚠ Not optional: a customer's name is free text, and a single stray control
 * character in one makes Excel refuse the whole file as corrupt. A
 * character-code filter rather than a regex, for the reason given in
 * `platform/filesystem.ts` (eslint no-control-regex).
 */
function xmlText(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    if (code === 0xfffe || code === 0xffff || (code >= 0xd800 && code <= 0xdfff)) continue;
    if (char === '&') out += '&amp;';
    else if (char === '<') out += '&lt;';
    else if (char === '>') out += '&gt;';
    else if (char === '"') out += '&quot;';
    else out += char;
  }
  return out;
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnLetters(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/**
 * A date as Excel counts it: days since 1899-12-30, the time as a fraction.
 * Taken from the wall-clock parts, so the cell shows the vendor's own local
 * time — a spreadsheet date has no time zone to convert through.
 */
function excelSerial(d: Date): number {
  const wallClock = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return wallClock / 86_400_000 + 25_569;
}

/** Excel's limits on a tab label: 31 characters, none of `[ ] : * ? / \`. */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

function buildParts(sheet: Sheet): Record<string, string> {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const shared = (text: string): number => {
    let index = stringIndex.get(text);
    if (index === undefined) {
      index = strings.length;
      strings.push(text);
      stringIndex.set(text, index);
    }
    return index;
  };

  const headerRows = new Set(sheet.headerRows ?? (sheet.table ? [0] : []));
  /** The longest thing shown in each column, in characters. */
  const widths: number[] = [];
  const widen = (col: number, length: number) => {
    widths[col] = Math.max(widths[col] ?? 0, length);
  };

  let sheetData = '';
  sheet.rows.forEach((row, r) => {
    const isHeader = headerRows.has(r);
    let cells = '';
    row.forEach((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return;
      const ref = `${columnLetters(c)}${r + 1}`;
      if (cell instanceof Date) {
        if (Number.isNaN(cell.getTime())) return;
        cells += `<c r="${ref}" s="${STYLE.dateTime}"><v>${excelSerial(cell)}</v></c>`;
        widen(c, 16);
      } else if (typeof cell === 'number') {
        if (!Number.isFinite(cell)) return;
        const style = isHeader ? STYLE.header : Number.isInteger(cell) ? STYLE.integer : STYLE.decimal;
        cells += `<c r="${ref}" s="${style}"><v>${cell}</v></c>`;
        // Room for the thousands marks the number format adds.
        const digits = Math.abs(Math.trunc(cell)).toString().length;
        widen(c, digits + Math.floor((digits - 1) / 3) + (Number.isInteger(cell) ? 0 : 3) + (cell < 0 ? 1 : 0));
      } else {
        const style = isHeader ? STYLE.header : STYLE.plain;
        cells += `<c r="${ref}" t="s" s="${style}"><v>${shared(cell)}</v></c>`;
        // Bold runs a little wider than the regular weight the width is counted in.
        widen(c, Math.ceil(cell.length * (isHeader ? 1.15 : 1)));
      }
    });
    sheetData += `<row r="${r + 1}">${cells}</row>`;
  });

  // A filter arrow sits inside the title cell, so a table's columns get room for it.
  const padding = sheet.table ? 4 : 2;
  const cols = widths
    .map((length, c) => {
      const width = Math.min(Math.max((length ?? 0) + padding, 8), 60);
      return `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const lastCell = `${columnLetters(Math.max(widths.length, 1) - 1)}${Math.max(sheet.rows.length, 1)}`;
  const frozenTitles = sheet.table
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    : '';

  const worksheet =
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}">` +
    `<dimension ref="A1:${lastCell}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${frozenTitles}</sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${sheetData}</sheetData>` +
    (sheet.table ? `<autoFilter ref="A1:${lastCell}"/>` : '') +
    '</worksheet>';

  const workbook =
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${xmlText(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>';

  const sharedStrings =
    `${XML_HEAD}<sst xmlns="${NS_MAIN}" count="${strings.length}" uniqueCount="${strings.length}">` +
    strings.map((text) => `<si><t xml:space="preserve">${xmlText(text)}</t></si>`).join('') +
    '</sst>';

  return {
    '[Content_Types].xml': CONTENT_TYPES_XML,
    '_rels/.rels': ROOT_RELS_XML,
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS_XML,
    'xl/worksheets/sheet1.xml': worksheet,
    'xl/styles.xml': STYLES_XML,
    'xl/sharedStrings.xml': sharedStrings,
  };
}

// ─── Zip ─────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Compress with the browser's own deflate, or `null` where it has none (older
 * WebViews) — the entry is then stored as-is, which every zip reader accepts.
 * A few thousand orders are a megabyte or two uncompressed and a tenth of that
 * compressed, which matters on the phone app where the file crosses to native
 * code as base64.
 */
async function deflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function zip(files: Record<string, string>): Promise<Blob> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path);
    const raw = encoder.encode(content);
    const deflated = await deflateRaw(raw);
    const body = deflated && deflated.length < raw.length ? deflated : raw;
    const method = body === raw ? 0 : 8;
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(8, method, true);
    lv.setUint16(12, 0x21, true); // date: 1980-01-01 — a fixed stamp, the content says when
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint16(4, 20, true); // version made by
    ev.setUint16(6, 20, true); // version needed
    ev.setUint16(10, method, true);
    ev.setUint16(14, 0x21, true);
    ev.setUint32(16, crc, true);
    ev.setUint32(20, body.length, true);
    ev.setUint32(24, raw.length, true);
    ev.setUint16(28, name.length, true);
    ev.setUint32(42, offset, true);
    entry.set(name, 46);

    chunks.push(local, body);
    directory.push(entry);
    offset += local.length + body.length;
  }

  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, directory.length, true);
  dv.setUint16(10, directory.length, true);
  dv.setUint32(12, directorySize, true);
  dv.setUint32(16, offset, true);

  return new Blob([...chunks, ...directory, end], { type: XLSX_MIME });
}

export function spreadsheetBlob(sheet: Sheet): Promise<Blob> {
  return zip(buildParts(sheet));
}

// ─── File name ───────────────────────────────────────────────────────────────

/** `2026-10-05`, in the vendor's own time zone. */
export function isoDay(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Chez Hélène & Fils" → `chez-helene-fils`. Letters of any alphabet are kept. */
function fileSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/**
 * `wi-mall-<shop>-<what>-<when>.xlsx` — the platform and the shop first, so a
 * vendor with several shops (or an accountant with several vendors) can tell
 * the files apart in a Downloads folder. A shop with no name yet is skipped.
 */
export function exportFileName(storeName: string | null | undefined, ...parts: string[]): string {
  return `${['wi-mall', fileSlug(storeName ?? ''), ...parts].filter(Boolean).join('-')}.xlsx`;
}
