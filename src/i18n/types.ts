import type fr from './fr';

export type Locale = 'fr' | 'en';

export type TranslationKey = keyof typeof fr;

export type Translations = Record<TranslationKey, string>;

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
