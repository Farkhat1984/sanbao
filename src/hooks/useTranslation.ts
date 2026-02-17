"use client";

import { useState, useEffect, useCallback } from "react";
import { t as translate, getLocale, setLocale, initLocale, type Locale } from "@/lib/i18n";

/**
 * React hook for translations.
 *
 * Usage:
 *   const { t, locale, changeLocale } = useTranslation();
 *   <span>{t("sidebar.newChat")}</span>
 *   <button onClick={() => changeLocale("kk")}>Қазақша</button>
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  useEffect(() => {
    const init = initLocale();
    setLocaleState(init);
  }, []);

  const t = useCallback(
    (key: string) => translate(key, locale),
    [locale]
  );

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  return { t, locale, changeLocale };
}
