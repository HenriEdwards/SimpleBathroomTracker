import type { AppSettings, BathroomEvent } from '../types';
import i18n from '../i18n';
import { formatDate, formatTime } from './time';

export type ExportSummary = {
  rangeLabel: string;
  total: number;
  pee: number;
  poop: number;
};

export type ExportChartSeries = {
  label: string;
  color: string;
  values: number[];
};

export type ExportChart = {
  series: ExportChartSeries[];
  maxValue: number;
  canShow: boolean;
  gridColor: string;
  textColor: string;
  mutedColor: string;
  bgColor: string;
  borderColor: string;
  xLabels: string[];
  xTickIndices: number[];
};

export function buildPlainText(events: BathroomEvent[], settings: AppSettings): string {
  return events
    .map((event) => {
      const label = event.type === 'pee' ? i18n.t('eventTypes.pee') : i18n.t('eventTypes.poop');
      const icon = event.type === 'pee' ? settings.iconPee : settings.iconPoop;
      return `${formatDate(event.ts)} ${formatTime(event.ts, settings.timeFormat)} ${icon} ${label}`.trim();
    })
    .join('\n');
}

export function buildCSV(events: BathroomEvent[], settings: AppSettings): string {
  const header = [
    i18n.t('export.csvHeaderDate'),
    i18n.t('export.csvHeaderTime'),
    i18n.t('export.csvHeaderType'),
    i18n.t('export.csvHeaderTimestamp'),
  ].join(',');
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
  summary: ExportSummary,
  chart?: ExportChart | null
): string {
  const peeLabel = i18n.t('eventTypes.pee');
  const poopLabel = i18n.t('eventTypes.poop');
  const rangeSummary = i18n.t('export.rangeSummary', { range: summary.rangeLabel });
  const totalSummary = i18n.t('export.totalSummary', {
    total: summary.total,
    pee: summary.pee,
    poop: summary.poop,
    peeLabel,
    poopLabel,
  });
  const rows = events
    .map((event) => {
      const date = formatDate(event.ts);
      const time = formatTime(event.ts, settings.timeFormat);
      const label = event.type === 'pee' ? peeLabel : poopLabel;
      return `<tr><td>${date}</td><td>${time}</td><td>${label}</td></tr>`;
    })
    .join('');

  const chartMarkup =
    chart && chart.canShow
      ? `
      <div class="chart-card" style="background:${chart.bgColor}; border-color:${chart.borderColor};">
        <div class="chart-title" style="color:${chart.mutedColor};">${i18n.t('export.pdfTrendTitle')}</div>
        ${buildChartSvg(chart)}
        <div class="legend" style="color:${chart.mutedColor};">
          ${chart.series
            .map(
              (series) => `
            <div class="legend-item">
              <span class="legend-swatch" style="background:${series.color};"></span>
              <span>${series.label}</span>
            </div>`
            )
            .join('')}
        </div>
      </div>`
      : '';

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1F242A; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        .summary { margin-bottom: 16px; font-size: 12px; color: #5C646E; }
        .chart-card { margin-bottom: 16px; padding: 12px; border-radius: 12px; border: 1px solid; }
        .chart-title { font-size: 12px; font-weight: 600; margin-bottom: 6px; }
        .legend { display: flex; gap: 12px; font-size: 11px; }
        .legend-item { display: inline-flex; align-items: center; gap: 6px; }
        .legend-swatch { width: 16px; height: 2px; display: inline-block; border-radius: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #E2E6EA; padding: 6px 4px; text-align: left; }
        th { background: #F5F7F9; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>${i18n.t('export.pdfTitle')}</h1>
      <div class="summary">
        <div>${rangeSummary}</div>
        <div>${totalSummary}</div>
      </div>
      ${chartMarkup}
      <table>
        <thead>
          <tr><th>${i18n.t('export.pdfTableDate')}</th><th>${i18n.t('export.pdfTableTime')}</th><th>${i18n.t('export.pdfTableType')}</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>`;
}

function buildChartSvg(chart: ExportChart): string {
  const width = 560;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const seriesLength = chart.series[0]?.values.length ?? 0;
  if (seriesLength === 0) {
    return '';
  }
  const step = seriesLength > 1 ? plotWidth / (seriesLength - 1) : 0;
  const safeMax = Math.max(1, chart.maxValue);

  const buildPoints = (values: number[]) =>
    values
      .map((value, index) => {
        const x = paddingLeft + (seriesLength > 1 ? index * step : plotWidth / 2);
        const normalized = value / safeMax;
        const y = paddingTop + plotHeight * (1 - normalized);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const yTicks = buildYAxisTicks(safeMax);
  const gridLines = yTicks
    .map((tick) => {
      const y = paddingTop + plotHeight * (1 - tick / safeMax);
      return `<line x1="${paddingLeft}" y1="${y.toFixed(2)}" x2="${(width - paddingRight).toFixed(
        2
      )}" y2="${y.toFixed(2)}" stroke="${chart.gridColor}" stroke-width="1" />`;
    })
    .join('');

  const seriesLines = chart.series
    .map(
      (series) => `
        <polyline
          points="${buildPoints(series.values)}"
          fill="none"
          stroke="${series.color}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />`
    )
    .join('');

  const xTickLabels = chart.xTickIndices
    .map((index) => {
      const label = chart.xLabels[index] ?? '';
      const x = paddingLeft + (seriesLength > 1 ? index * step : plotWidth / 2);
      const y = paddingTop + plotHeight + 16;
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="10" fill="${chart.mutedColor}">${label}</text>`;
    })
    .join('');

  const yTickLabels = yTicks
    .map((tick) => {
      const y = paddingTop + plotHeight * (1 - tick / safeMax);
      return `<text x="${(paddingLeft - 6).toFixed(2)}" y="${(y + 3).toFixed(
        2
      )}" text-anchor="end" font-size="10" fill="${chart.mutedColor}">${tick}</text>`;
    })
    .join('');

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { font-family: Arial, sans-serif; }
      </style>
      ${gridLines}
      <line x1="${paddingLeft}" y1="${(paddingTop + plotHeight).toFixed(2)}" x2="${(width - paddingRight).toFixed(
        2
      )}" y2="${(paddingTop + plotHeight).toFixed(2)}" stroke="${chart.gridColor}" stroke-width="1" />
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${(paddingTop + plotHeight).toFixed(
        2
      )}" stroke="${chart.gridColor}" stroke-width="1" />
      ${seriesLines}
      ${xTickLabels}
      ${yTickLabels}
    </svg>
  `;
}

function buildYAxisTicks(maxValue: number): number[] {
  if (maxValue <= 0) {
    return [0];
  }
  const steps = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.ceil(maxValue * ratio));
  const unique = Array.from(new Set(steps));
  return unique.sort((a, b) => a - b);
}
