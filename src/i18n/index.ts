import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fr from './fr';
import en from './en';
import type { Locale, Translations, TranslationKey, TranslateFn } from './types';

// ─── Translation maps ──────────────────────────────────────────────────────────

const translations: Record<Locale, Translations> = { fr, en };

const STORAGE_KEY = '@lamaison/locale';
const DEFAULT_LOCALE: Locale = 'fr';

// ─── Context ──────────────────────────────────────────────────────────────────

type I18nContextValue = {
  locale:    Locale;
  setLocale: (locale: Locale) => void;
  t:         TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored === 'fr' || stored === 'en') {
          setLocaleState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((next: Locale): void => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback<TranslateFn>((key, params) => {
    const dict = translations[locale];
    // Fallback to French if key missing in current locale
    const str: string = (dict as Record<string, string>)[key]
      ?? (fr as Record<string, string>)[key]
      ?? key;

    if (!params) return str;

    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      str,
    );
  }, [locale]);

  return React.createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}

export type { Locale, TranslationKey, TranslateFn };
