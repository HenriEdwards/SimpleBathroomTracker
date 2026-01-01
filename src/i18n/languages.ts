export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'pt',
  'fr',
  'hi',
  'id',
  'de',
  'ja',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  if (!value) {
    return false;
  }
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }
  const base = value.toLowerCase().split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}
