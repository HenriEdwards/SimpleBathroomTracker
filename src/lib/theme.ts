export type ThemePreset = {
  id: 't1' | 't2' | 't3' | 't4' | 't5';
  name: string;
  accent: string;
  accentText: string;
};

export type ThemeMode = 'light' | 'dark';
export type ThemeModePreference = ThemeMode | 'system';

export type Theme = {
  id: ThemePreset['id'];
  name: string;
  mode: ThemeMode;
  colors: {
    bg: string;
    card: string;
    text: string;
    muted: string;
    mutedText: string;
    border: string;
    primary: string;
    primaryText: string;
    accent: string;
    accentText: string;
  };
};

const BASE_COLORS: Record<ThemeMode, Omit<Theme['colors'], 'primary' | 'primaryText' | 'accent' | 'accentText'>> = {
  light: {
    bg: '#F6F2EC',
    card: '#FFFFFF',
    text: '#2A2622',
    muted: '#6E655E',
    mutedText: '#6E655E',
    border: '#E2DBD2',
  },
  dark: {
    bg: '#15110E',
    card: '#1F1B18',
    text: '#F3EDE6',
    muted: '#B2AAA3',
    mutedText: '#B2AAA3',
    border: '#2E2723',
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 't1',
    name: 'Linen',
    accent: '#4E7F6C',
    accentText: '#FFFFFF',
  },
  {
    id: 't2',
    name: 'Lake',
    accent: '#2C6B8F',
    accentText: '#FFFFFF',
  },
  {
    id: 't3',
    name: 'Citrus',
    accent: '#F28C28',
    accentText: '#FFFFFF',
  },
  {
    id: 't4',
    name: 'Slate',
    accent: '#3E566E',
    accentText: '#FFFFFF',
  },
  {
    id: 't5',
    name: 'Forest',
    accent: '#2F6B3F',
    accentText: '#FFFFFF',
  },
];

export function resolveThemeMode(
  preference: ThemeModePreference | undefined,
  systemMode: ThemeMode | null | undefined
): ThemeMode {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  if (preference === 'system' || !preference) {
    return systemMode === 'dark' ? 'dark' : 'light';
  }
  return 'light';
}

export function getTheme(options: { presetId: ThemePreset['id']; mode: ThemeMode }): Theme {
  const preset = THEME_PRESETS.find((theme) => theme.id === options.presetId) ?? THEME_PRESETS[0];
  const base = BASE_COLORS[options.mode] ?? BASE_COLORS.light;
  return {
    id: preset.id,
    name: preset.name,
    mode: options.mode,
    colors: {
      ...base,
      primary: preset.accent,
      primaryText: preset.accentText,
      accent: preset.accent,
      accentText: preset.accentText,
    },
  };
}
