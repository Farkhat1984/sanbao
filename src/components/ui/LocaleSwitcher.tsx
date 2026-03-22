"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { LOCALES } from "@sanbao/shared/i18n";
import type { Locale } from "@sanbao/shared/i18n";

/**
 * Compact locale switcher dropdown.
 * Toggles between Russian (default) and Kazakh.
 * Persists choice via the shared i18n setLocale (localStorage).
 */
export function LocaleSwitcher() {
  const { locale, changeLocale } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(e) => changeLocale(e.target.value as Locale)}
      aria-label={locale === "ru" ? "Язык" : "Тіл"}
      className="h-8 px-2 pr-7 rounded-lg bg-surface-alt border border-border text-xs text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_6px_center] bg-no-repeat"
    >
      {LOCALES.map((loc) => (
        <option key={loc.value} value={loc.value}>
          {loc.label}
        </option>
      ))}
    </select>
  );
}
