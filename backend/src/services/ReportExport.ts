/**
 * ReportExport.ts
 *
 * A report (ReportService) as an Excel workbook or a PDF, for downloads from
 * the web admin and for scheduled report emails (UC-A06). Both carry the same
 * content as the CSV: summary, figures per period, then each table.
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Report } from './ReportService';
import { money, number, toLocalClock } from '../config/region';

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const TITLES: Record<Report['type'], string> = {
  users: 'Users',
  rides: 'Rides',
  financial: 'Money',
  performance: 'Performance',
  safety: 'Safety',
};

/** The Zimbabwe calendar day of an ISO instant, as YYYY-MM-DD */
export const localDay = (iso: string) => toLocalClock(new Date(iso)).toISOString().slice(0, 10);

export const reportTitle = (report: Report) => `${TITLES[report.type]} report`;
export const reportFilename = (report: Report, format: ExportFormat) =>
  `poolora-${report.type}-${localDay(report.from)}-to-${localDay(report.to)}.${format}`;

/** A summary figure as people read it: US$ amounts, 12.5%, 4.25, 18 min */
export function formatFigure(value: number, format: Report['summary'][number]['format']): string {
  switch (format) {
    case 'money': return money(value);
    case 'percent': return `${Math.round(value * 1000) / 10}%`;
    case 'decimal': return value ? value.toFixed(2) : '—';
    case 'minutes': return value ? `${number(value)} min` : '—';
    default: return number(value);
  }
}

/** Series column keys in table order, with their labels */
function seriesHeader(report: Report): Array<{ key: string; label: string }> {
  const keys = Object.keys(report.series[0] ?? {}).filter((k) => k !== 'period');
  return keys.map((key) => ({ key, label: report.seriesColumns.find((c) => c.key === key)?.label ?? key }));
}

const periodDay = (iso: unknown) => localDay(String(iso));
const rangeText = (report: Report) => `${localDay(report.from)} to ${localDay(report.to)}, by ${report.groupBy}`;

export async function toXlsx(report: Report): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = 'Poolora';
  book.created = new Date();

  const summary = book.addWorksheet('Summary');
  summary.addRow([`Poolora ${reportTitle(report).toLowerCase()}`]).font = { bold: true, size: 14 };
  summary.addRow([rangeText(report), 'Zimbabwe time']);
  summary.addRow([]);
  summary.addRow(['Figure', 'Value']).font = { bold: true };
  for (const s of report.summary) {
    const row = summary.addRow([s.label, s.value]);
    const cell = row.getCell(2);
    if (s.format === 'money') cell.numFmt = '"US$"#,##0.00';
    else if (s.format === 'percent') cell.numFmt = '0.0%';
    else if (s.format === 'decimal') cell.numFmt = '0.00';
  }
  summary.getColumn(1).width = 36;
  summary.getColumn(2).width = 18;

  const header = seriesHeader(report);
  const byPeriod = book.addWorksheet(`By ${report.groupBy}`);
  byPeriod.addRow(['Period start', ...header.map((h) => h.label)]).font = { bold: true };
  for (const row of report.series) {
    byPeriod.addRow([periodDay(row.period), ...header.map((h) => Number(row[h.key] ?? 0))]);
  }
  header.forEach((h, i) => {
    const format = report.seriesColumns.find((c) => c.key === h.key)?.format;
    const column = byPeriod.getColumn(i + 2);
    column.width = Math.max(14, h.label.length + 2);
    if (format === 'money') column.numFmt = '"US$"#,##0.00';
    else if (format === 'percent') column.numFmt = '0.0%';
  });
  byPeriod.getColumn(1).width = 14;
  byPeriod.views = [{ state: 'frozen', ySplit: 1 }];

  const used = new Set(['summary', `by ${report.groupBy}`]);
  for (const table of report.tables) {
    // Sheet names: at most 31 characters, unique, no []:*?/\
    let name = table.title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Table';
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    const sheet = book.addWorksheet(name);
    sheet.addRow(table.columns).font = { bold: true };
    for (const r of table.rows) sheet.addRow(r);
    table.columns.forEach((c, i) => { sheet.getColumn(i + 1).width = Math.max(12, Math.min(40, c.length + 4)); });
  }

  return Buffer.from(await book.xlsx.writeBuffer());
}

export function toPdf(report: Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Poolora ${reportTitle(report)}`, Author: 'Poolora' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    // The built-in PDF fonts have no em dash
    const plain = (s: string) => s.replace(/—/g, '-');

    /** A simple table: header row in bold, then rows, breaking pages as needed */
    const table = (columns: string[], rows: Array<Array<string | number>>) => {
      const colWidth = width / Math.max(1, columns.length);
      const drawRow = (cells: Array<string | number>, bold: boolean) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        const heights = cells.map((c) => doc.heightOfString(plain(String(c)), { width: colWidth - 6 }));
        const h = Math.max(12, ...heights) + 4;
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        cells.forEach((c, i) => {
          const numeric = typeof c === 'number';
          doc.text(plain(numeric ? number(c) : String(c)), left + i * colWidth, y, {
            width: colWidth - 6,
            align: numeric && i > 0 ? 'right' : 'left',
          });
        });
        doc.y = y + h;
        doc.x = left;
      };
      drawRow(columns, true);
      doc.moveTo(left, doc.y - 2).lineTo(left + width, doc.y - 2).strokeColor('#cccccc').stroke();
      for (const r of rows) drawRow(r, false);
      doc.moveDown(1);
    };
    const heading = (text: string) => {
      if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a').text(plain(text), left, doc.y);
      doc.moveDown(0.4);
    };

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b7a75').text('Poolora');
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a').text(reportTitle(report));
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text(`${rangeText(report)}. Zimbabwe time.`);
    doc.fillColor('#1a1a1a').moveDown(1);

    heading('Summary');
    table(['Figure', 'Value'], report.summary.map((s) => [s.label, formatFigure(s.value, s.format)]));

    const header = seriesHeader(report);
    heading(`By ${report.groupBy}`);
    table(
      ['Period start', ...header.map((h) => h.label)],
      report.series.map((row) => [periodDay(row.period), ...header.map((h) => Number(row[h.key] ?? 0))]),
    );

    for (const t of report.tables) {
      heading(t.title);
      if (t.rows.length) table(t.columns, t.rows);
      else doc.font('Helvetica').fontSize(9).text('Nothing in this range.').moveDown(1);
    }

    doc.end();
  });
}
