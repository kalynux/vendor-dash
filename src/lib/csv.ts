import type { Locale } from '@/i18n/config';

export type CsvCell = string | number | null | undefined;

/**
 * Spreadsheet-ready CSV for the export buttons.
 *
 * The separator follows the language, because that is what the vendor's
 * spreadsheet expects: Excel set up for French (and Spanish, Portuguese,
 * Arabic) reads `;` and treats a comma-separated file as one long column, while
 * an English setup reads `,`. Numbers are written bare — no thousands
 * separators, no currency — so they stay numbers once opened.
 *
 * The leading byte-order mark is what makes Excel read the file as UTF-8;
 * without it "Payée" arrives as "PayÃ©e".
 */
export function toCsv(rows: CsvCell[][], locale: Locale): string {
  const separator = locale === 'en' ? ',' : ';';
  const escape = (cell: CsvCell): string => {
    if (cell === null || cell === undefined) return '';
    const text = String(cell);
    return /["\n\r,;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '﻿' + rows.map((row) => row.map(escape).join(separator)).join('\r\n');
}

export function csvBlob(rows: CsvCell[][], locale: Locale): Blob {
  return new Blob([toCsv(rows, locale)], { type: 'text/csv;charset=utf-8' });
}

/**
 * `2026-10-05 14:30` in the vendor's own time zone — sorts correctly as text
 * and every spreadsheet recognises it as a date.
 */
export function csvDateTime(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function csvDate(value: string | Date): string {
  return csvDateTime(value).slice(0, 10);
}
