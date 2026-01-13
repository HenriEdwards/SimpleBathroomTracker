type ThemeSurface = {
  bg: string;
  card: string;
  text: string;
};

export type ThemePreset = {
  id: 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't_peachy';
  name: string;
  accent: string;
  accentSecondary?: string;
  accentText: string;
  light: ThemeSurface;
  dark: ThemeSurface;
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
    accentSecondary: string;
    accentText: string;
  };
};

const DEFAULT_SURFACE: Record<ThemeMode, ThemeSurface> = {
  light: {
    bg: '#F6F2EC',
    card: '#FFFFFF',
    text: '#2A2622',
  },
  dark: {
    bg: '#15110E',
    card: '#1F1B18',
    text: '#F3EDE6',
  },
};

const MUTED_BLEND = 0.3;
const BORDER_BLEND = 0.12;
const DARK_TINT_BG = 0.08;
const DARK_TINT_CARD = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(color: string): [number, number, number] {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) {
    return [0, 0, 0];
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function mixColors(base: string, overlay: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(overlay);
  const t = clamp(amount, 0, 1);
  const r = Math.round(r1 * (1 - t) + r2 * t);
  const g = Math.round(g1 * (1 - t) + g2 * t);
  const b = Math.round(b1 * (1 - t) + b2 * t);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 't1',
    name: 'Linen',
    accent: '#4E7F6C',
    accentSecondary: '#3D5C50',
    accentText: '#FFFFFF',
    light: {
      bg: '#F6F2EC',
      card: '#FFFFFF',
      text: '#2A2622',
    },
    dark: {
      bg: '#15110E',
      card: '#1F1B18',
      text: '#F3EDE6',
    },
  },
  {
    id: 't2',
    name: 'Ocean',
    accent: '#2C6B8F',
    accentSecondary: '#1F4E6A',
    accentText: '#FFFFFF',
    light: {
      bg: '#F1F6F9',
      card: '#FFFFFF',
      text: '#1F2A35',
    },
    dark: {
      bg: '#0F141B',
      card: '#18212A',
      text: '#E8EFF5',
    },
  },
  {
    id: 't3',
    name: 'Ember',
    accent: '#E56B2C',
    accentSecondary: '#8C4324',
    accentText: '#FFFFFF',
    light: {
      bg: '#F9F1EB',
      card: '#FFFFFF',
      text: '#3A231B',
    },
    dark: {
      bg: '#1A120E',
      card: '#241914',
      text: '#F6ECE6',
    },
  },
  {
    id: 't4',
    name: 'Violet',
    accent: '#7B5CE6',
    accentSecondary: '#4D3F80',
    accentText: '#FFFFFF',
    light: {
      bg: '#F5F1FA',
      card: '#FFFFFF',
      text: '#2A2138',
    },
    dark: {
      bg: '#15101F',
      card: '#1E162B',
      text: '#F1EAFB',
    },
  },
  {
    id: 't5',
    name: 'Slate',
    accent: '#5B6B73',
    accentSecondary: '#3C474D',
    accentText: '#FFFFFF',
    light: {
      bg: '#F3F4F6',
      card: '#FFFFFF',
      text: '#1F2328',
    },
    dark: {
      bg: '#121416',
      card: '#1B1F23',
      text: '#E6E8EA',
    },
  },
  {
    id: 't6',
    name: 'Dune',
    accent: '#C38A2E',
    accentSecondary: '#7A5A22',
    accentText: '#FFFFFF',
    light: {
      bg: '#F7F1E7',
      card: '#FFFFFF',
      text: '#3A2C1B',
    },
    dark: {
      bg: '#1A140E',
      card: '#251B13',
      text: '#F5EBDD',
    },
  },
  {
    id: 't7',
    name: 'Mint',
    accent: '#2E9C82',
    accentSecondary: '#1E6556',
    accentText: '#FFFFFF',
    light: {
      bg: '#EFF6F4',
      card: '#FFFFFF',
      text: '#1F2C2A',
    },
    dark: {
      bg: '#111816',
      card: '#19221F',
      text: '#E7F2EE',
    },
  },
  {
    id: 't_peachy',
    name: 'Rose',
    accent: '#E05A8E',
    accentSecondary: '#80324D',
    accentText: '#FFFFFF',
    light: {
      bg: '#F9F1F4',
      card: '#FFFFFF',
      text: '#3A1F2B',
    },
    dark: {
      bg: '#1A1014',
      card: '#24161C',
      text: '#F6E9EE',
    },
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
  const surface = preset[options.mode] ?? DEFAULT_SURFACE[options.mode];
  const accentSecondary = preset.accentSecondary ?? preset.accent;
  const bg =
    options.mode === 'dark' ? mixColors(surface.bg, accentSecondary, DARK_TINT_BG) : surface.bg;
  const card =
    options.mode === 'dark'
      ? mixColors(surface.card, accentSecondary, DARK_TINT_CARD)
      : surface.card;
  const muted = mixColors(surface.text, bg, MUTED_BLEND);
  const border = mixColors(bg, surface.text, BORDER_BLEND);
  return {
    id: preset.id,
    name: preset.name,
    mode: options.mode,
    colors: {
      bg,
      card,
      text: surface.text,
      muted,
      mutedText: muted,
      border,
      primary: preset.accent,
      primaryText: preset.accentText,
      accent: preset.accent,
      accentSecondary,
      accentText: preset.accentText,
    },
  };
}
