import i18n from '../i18n';
import { normalizeLanguage } from '../i18n/languages';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function resolveLocale(locale?: string): string {
  return normalizeLanguage(locale ?? i18n.language);
}

function formatWithIntl(
  ts: number,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  fallback: () => string
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(ts));
  } catch {
    return fallback();
  }
}

export function formatTime(ts: number, mode: '24h' | '12h', locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return formatWithIntl(
    ts,
    resolvedLocale,
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: mode === '12h',
    },
    () => {
      const date = new Date(ts);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      if (mode === '24h') {
        return `${pad2(hours)}:${pad2(minutes)}`;
      }
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      return `${hour12}:${pad2(minutes)} ${suffix}`;
    }
  );
}

export function formatDate(ts: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return formatWithIntl(
    ts,
    resolvedLocale,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    () => {
      const date = new Date(ts);
      const year = date.getFullYear();
      const month = pad2(date.getMonth() + 1);
      const day = pad2(date.getDate());
      return `${year}-${month}-${day}`;
    }
  );
}

export function formatShortDate(ts: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return formatWithIntl(
    ts,
    resolvedLocale,
    { month: 'numeric', day: 'numeric' },
    () => {
      const date = new Date(ts);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  );
}

export function formatMonthLabel(ts: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return formatWithIntl(
    ts,
    resolvedLocale,
    { month: 'short' },
    () => {
      const date = new Date(ts);
      return `${date.getMonth() + 1}`;
    }
  );
}

export function formatMonthYearLabel(ts: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return formatWithIntl(
    ts,
    resolvedLocale,
    { month: 'short', year: 'numeric' },
    () => {
      const date = new Date(ts);
      return `${date.getMonth() + 1} ${date.getFullYear()}`;
    }
  );
}

export function formatDateTime(ts: number, mode: '24h' | '12h', locale?: string): string {
  return `${formatDate(ts, locale)} ${formatTime(ts, mode, locale)}`;
}

export function formatNumber(value: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  try {
    return new Intl.NumberFormat(resolvedLocale).format(value);
  } catch {
    return `${value}`;
  }
}
