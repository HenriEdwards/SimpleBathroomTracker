import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import type { SupportedLanguage } from './languages';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage } from './languages';
import en from './translations/en.json';
import es from './translations/es.json';
import pt from './translations/pt.json';
import fr from './translations/fr.json';
import hi from './translations/hi.json';
import id from './translations/id.json';
import de from './translations/de.json';
import ja from './translations/ja.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  hi: { translation: hi },
  id: { translation: id },
  de: { translation: de },
  ja: { translation: ja },
};

let initialized = false;
let initPromise: Promise<void> | null = null;

function resolveDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales?.();
  const languageTag = locales?.[0]?.languageTag ?? Localization.locale ?? DEFAULT_LANGUAGE;
  return normalizeLanguage(languageTag);
}

export async function initI18n(preferred?: SupportedLanguage): Promise<void> {
  const resolved = normalizeLanguage(preferred ?? resolveDeviceLanguage());
  if (!initPromise) {
    initPromise = Promise.resolve(
      i18n.use(initReactI18next).init({
        resources,
        lng: resolved,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGES,
        returnNull: false,
        returnEmptyString: false,
        initImmediate: false,
        interpolation: {
          escapeValue: false,
          format: (value, format, lng) => {
            if (format === 'number' && typeof value === 'number') {
              return new Intl.NumberFormat(lng).format(value);
            }
            return value as string;
          },
        },
        react: {
          useSuspense: false,
        },
        saveMissing: __DEV__,
        missingKeyHandler: __DEV__
          ? (_lngs, _ns, key) => {
              console.warn(`[i18n] Missing translation key: ${key}`);
            }
          : undefined,
      }) as Promise<void>
    );
  }
  await initPromise;
  initialized = true;
  if (i18n.language !== resolved) {
    await i18n.changeLanguage(resolved);
  }
}

export async function setI18nLanguage(language: SupportedLanguage): Promise<void> {
  await initI18n(language);
}

export function getCurrentLanguage(): SupportedLanguage {
  return normalizeLanguage(i18n.language);
}

export function getDeviceLanguage(): SupportedLanguage {
  return resolveDeviceLanguage();
}

export default i18n;
