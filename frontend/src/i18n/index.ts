import { useCallback } from 'react';
import { useLanguageStore } from './store';
import { zhCN } from './locales/zh-CN';
import { enUS } from './locales/en-US';
import { Locale, Translations } from './types';

const translations: Record<Locale, Translations> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : path;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function useTranslation() {
  const { locale, setLocale } = useLanguageStore();

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const translation = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
      return interpolate(translation, vars);
    },
    [locale]
  );

  return {
    t,
    locale,
    setLocale,
    isZh: locale === 'zh-CN',
    isEn: locale === 'en-US',
  };
}

export function getTranslation(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const translation = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
  return interpolate(translation, vars);
}

export { useLanguageStore } from './store';
export type { Locale, Translations } from './types';
