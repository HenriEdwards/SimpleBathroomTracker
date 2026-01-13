export type EventType = 'pee' | 'poop';

export type ThemeMode = 'light' | 'dark';
export type ThemeModePreference = ThemeMode | 'system';
export type LanguageCode = 'en' | 'es' | 'pt' | 'fr' | 'hi' | 'id' | 'de' | 'ja';

export type BathroomEvent = {
  id: string;
  type: EventType;
  ts: number;
};

export type AppSettings = {
  timeFormat: '24h' | '12h';
  themeId: 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't_peachy';
  themeMode?: ThemeModePreference;
  widgetOpacity?: number;
  iconPee: string;
  iconPoop: string;
  language?: LanguageCode;
};

export type ProState = {
  isPro: boolean;
  devProOverride: boolean;
};
