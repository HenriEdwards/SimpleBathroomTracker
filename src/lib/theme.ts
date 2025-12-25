export type ThemePreset = {
  id: 't1' | 't2' | 't3' | 't4' | 't5';
  name: string;
  colors: {
    bg: string;
    card: string;
    text: string;
    muted: string;
    primary: string;
    primaryText: string;
    border: string;
  };
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 't1',
    name: 'Linen',
    colors: {
      bg: '#F6F2EC',
      card: '#FFFFFF',
      text: '#2A2622',
      muted: '#6E655E',
      primary: '#4E7F6C',
      primaryText: '#FFFFFF',
      border: '#E2DBD2',
    },
  },
  {
    id: 't2',
    name: 'Lake',
    colors: {
      bg: '#EEF5F8',
      card: '#FFFFFF',
      text: '#1F2A33',
      muted: '#5E6C75',
      primary: '#2C6B8F',
      primaryText: '#FFFFFF',
      border: '#D7E3EA',
    },
  },
  {
    id: 't3',
    name: 'Citrus',
    colors: {
      bg: '#FFF6E8',
      card: '#FFFFFF',
      text: '#2C2218',
      muted: '#7A6A58',
      primary: '#F28C28',
      primaryText: '#FFFFFF',
      border: '#F1E1CE',
    },
  },
  {
    id: 't4',
    name: 'Slate',
    colors: {
      bg: '#F1F3F5',
      card: '#FFFFFF',
      text: '#1F242A',
      muted: '#5C646E',
      primary: '#3E566E',
      primaryText: '#FFFFFF',
      border: '#D9DEE3',
    },
  },
  {
    id: 't5',
    name: 'Forest',
    colors: {
      bg: '#EFF5EF',
      card: '#FFFFFF',
      text: '#1C2B22',
      muted: '#5C6A62',
      primary: '#2F6B3F',
      primaryText: '#FFFFFF',
      border: '#D8E2D8',
    },
  },
];

export function getTheme(themeId: ThemePreset['id']): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.id === themeId) ?? THEME_PRESETS[0];
}
