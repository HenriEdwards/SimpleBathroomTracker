import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppSettings, BathroomEvent, EventType, ProState } from '../types';

const BC_EVENTS = 'BC_EVENTS';
const BC_SETTINGS = 'BC_SETTINGS';
const BC_PRO = 'BC_PRO';

const DEFAULT_SETTINGS: AppSettings = {
  timeFormat: '24h',
  themeId: 't1',
  iconPee: 'dYs«',
  iconPoop: "dY'c",
};

const DEFAULT_PRO: ProState = {
  isPro: false,
  devProOverride: false,
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return safeParse<T>(raw);
}

async function saveJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadEvents(): Promise<BathroomEvent[]> {
  const stored = await loadJson<BathroomEvent[]>(BC_EVENTS);
  if (!Array.isArray(stored)) {
    return [];
  }
  const normalized = stored.filter(
    (item) => item && typeof item.ts === 'number' && item.id && item.type
  );
  return normalized.sort((a, b) => b.ts - a.ts);
}

export async function saveEvents(events: BathroomEvent[]): Promise<void> {
  await saveJson(BC_EVENTS, events);
}

export async function appendEvent(type: EventType): Promise<BathroomEvent> {
  const events = await loadEvents();
  const next: BathroomEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    ts: Date.now(),
  };
  events.unshift(next);
  await saveEvents(events);
  return next;
}

export async function clearAllEvents(): Promise<void> {
  await saveEvents([]);
}

export async function loadSettings(): Promise<AppSettings> {
  const stored = await loadJson<AppSettings>(BC_SETTINGS);
  if (!stored) {
    return DEFAULT_SETTINGS;
  }
  return {
    timeFormat: stored.timeFormat === '12h' ? '12h' : '24h',
    themeId: stored.themeId ?? 't1',
    iconPee: stored.iconPee ?? DEFAULT_SETTINGS.iconPee,
    iconPoop: stored.iconPoop ?? DEFAULT_SETTINGS.iconPoop,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await saveJson(BC_SETTINGS, settings);
}

export async function loadProState(): Promise<ProState> {
  const stored = await loadJson<ProState>(BC_PRO);
  if (!stored) {
    return DEFAULT_PRO;
  }
  return {
    isPro: Boolean(stored.isPro),
    devProOverride: Boolean(stored.devProOverride),
  };
}

export async function saveProState(state: ProState): Promise<void> {
  await saveJson(BC_PRO, state);
}
