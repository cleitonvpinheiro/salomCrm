import { useEffect, useMemo, useState, type ReactNode } from "react";

import { I18nContext, SUPPORTED_LOCALES, translations, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "atelier-locale";

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && SUPPORTED_LOCALES.includes(saved as Locale) ? (saved as Locale) : "pt-BR";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (nextLocale: Locale) => {
    localStorage.setItem(STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (text: string, values?: Record<string, string | number>) => {
        const translated = translations[locale][text] ?? text;
        return Object.entries(values ?? {}).reduce(
          (result, [key, replacement]) =>
            result.replaceAll(`{${key}}`, String(replacement)),
          translated
        );
      },
      formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(date),
    }),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translations[locale]["App title"];
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
