import type { AppSettings, BathroomEvent } from '../types';
import { formatDate, formatTime } from './time';

export type ExportSummary = {
  rangeLabel: string;
  total: number;
  pee: number;
  poop: number;
};

export function buildPlainText(events: BathroomEvent[], settings: AppSettings): string {
  return events
    .map((event) => {
      const label = event.type === 'pee' ? 'Pee' : 'Poop';
      const icon = event.type === 'pee' ? settings.iconPee : settings.iconPoop;
      return `${formatDate(event.ts)} ${formatTime(event.ts, settings.timeFormat)} ${icon} ${label}`.trim();
    })
    .join('\n');
}

export function buildCSV(events: BathroomEvent[], settings: AppSettings): string {
  const header = 'date,time,type,timestamp';
  const rows = events.map((event) => {
    const date = formatDate(event.ts);
    const time = formatTime(event.ts, settings.timeFormat);
    return `${date},${time},${event.type},${event.ts}`;
  });
  return [header, ...rows].join('\n');
}

export function buildPdfHtml(
  events: BathroomEvent[],
  settings: AppSettings,
  summary: ExportSummary
): string {
  const rows = events
    .map((event) => {
      const date = formatDate(event.ts);
      const time = formatTime(event.ts, settings.timeFormat);
      const label = event.type === 'pee' ? 'Pee' : 'Poop';
      return `<tr><td>${date}</td><td>${time}</td><td>${label}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1F242A; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        .summary { margin-bottom: 16px; font-size: 12px; color: #5C646E; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #E2E6EA; padding: 6px 4px; text-align: left; }
        th { background: #F5F7F9; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>Simple Bathroom Tracker Export</h1>
      <div class="summary">
        <div>Range: ${summary.rangeLabel}</div>
        <div>Total: ${summary.total} (Pee ${summary.pee} / Poop ${summary.poop})</div>
      </div>
      <table>
        <thead>
          <tr><th>Date</th><th>Time</th><th>Type</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>`;
}
