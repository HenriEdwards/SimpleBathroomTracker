import { NativeModules, Platform } from 'react-native';

import type { AppSettings, BathroomEvent } from '../types';
import i18n from '../i18n';
import { getTheme } from './theme';
import type { ThemeMode } from './theme';

type WidgetBridgeModule = {
  getQueuedEvents: () => Promise<string>;
  clearQueuedEvents: () => Promise<void>;
  setWidgetSettingsMirror?: (
    iconPee: string,
    iconPoop: string,
    themeId: string,
    themeMode: string,
    widgetOpacity: number,
    timeFormat: string,
    lastLabel: string,
    bgColor: string,
    cardColor: string,
    textColor: string,
    mutedColor: string,
    accentColor: string,
    accentTextColor: string
  ) => Promise<void>;
  setWidgetSummary?: (
    todayDate: string,
    peeCount: number,
    poopCount: number,
    lastPeeTs: number,
    lastPoopTs: number
  ) => Promise<void>;
};

const widgetBridge: WidgetBridgeModule | null =
  Platform.OS === 'android' && NativeModules.WidgetBridge
    ? (NativeModules.WidgetBridge as WidgetBridgeModule)
    : null;

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dateKey(ts: number): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeQueuedEvents(raw: string): BathroomEvent[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        type: item.type === 'pee' ? 'pee' : item.type === 'poop' ? 'poop' : null,
        ts: typeof item.ts === 'number' ? item.ts : null,
      }))
      .filter((item): item is BathroomEvent => Boolean(item.id && item.type && item.ts !== null));
  } catch {
    return [];
  }
}

export async function getQueuedWidgetEvents(): Promise<BathroomEvent[]> {
  if (!widgetBridge?.getQueuedEvents) {
    return [];
  }
  const raw = await widgetBridge.getQueuedEvents();
  return normalizeQueuedEvents(raw);
}

export async function clearQueuedWidgetEvents(): Promise<void> {
  if (!widgetBridge?.clearQueuedEvents) {
    return;
  }
  await widgetBridge.clearQueuedEvents();
}

export async function mirrorWidgetSettings(
  settings: AppSettings,
  resolvedMode?: ThemeMode
): Promise<void> {
  if (!widgetBridge?.setWidgetSettingsMirror) {
    return;
  }
  const themeMode = resolvedMode ?? (settings.themeMode === 'dark' ? 'dark' : 'light');
  const widgetOpacity = settings.widgetOpacity ?? 1;
  const timeFormat = settings.timeFormat ?? '24h';
  const lastLabel = i18n.t('labels.last');
  const theme = getTheme({ presetId: settings.themeId ?? 't1', mode: themeMode });
  await widgetBridge.setWidgetSettingsMirror(
    settings.iconPee,
    settings.iconPoop,
    settings.themeId,
    themeMode,
    widgetOpacity,
    timeFormat,
    lastLabel,
    theme.colors.bg,
    theme.colors.card,
    theme.colors.text,
    theme.colors.muted,
    theme.colors.primary,
    theme.colors.accentText
  );
}

export async function mirrorWidgetSummary(events: BathroomEvent[]): Promise<void> {
  if (!widgetBridge?.setWidgetSummary) {
    return;
  }
  const now = Date.now();
  const todayStart = startOfDay(now);
  let peeCount = 0;
  let poopCount = 0;
  let lastPeeTs = 0;
  let lastPoopTs = 0;

  events.forEach((event) => {
    if (event.ts < todayStart) {
      return;
    }
    if (event.type === 'pee') {
      peeCount += 1;
      if (event.ts > lastPeeTs) {
        lastPeeTs = event.ts;
      }
    } else if (event.type === 'poop') {
      poopCount += 1;
      if (event.ts > lastPoopTs) {
        lastPoopTs = event.ts;
      }
    }
  });

  await widgetBridge.setWidgetSummary(
    dateKey(now),
    peeCount,
    poopCount,
    lastPeeTs,
    lastPoopTs
  );
}
