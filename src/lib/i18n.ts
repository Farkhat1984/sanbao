/**
 * Lightweight i18n system for Sanbao.
 *
 * Usage:
 *   import { t } from "@/lib/i18n";
 *   t("sidebar.newChat")          // "Новый чат" (ru) or "Жаңа чат" (kk)
 *   t("billing.messagesPerDay")   // etc.
 *
 * Locale is set via setLocale() and persisted in localStorage.
 * Server-side defaults to "ru".
 */

import ruMessages from "@/messages/ru.json";
import kkMessages from "@/messages/kk.json";

export type Locale = "ru" | "kk";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "kk", label: "Қазақша" },
];

const messages: Record<Locale, Record<string, Record<string, string>>> = {
  ru: ruMessages,
  kk: kkMessages,
};

const LOCALE_KEY = "sanbao-locale";

let currentLocale: Locale = "ru";

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set the current locale. Persists to localStorage if available.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCALE_KEY, locale);
  }
}

/**
 * Initialize locale from localStorage (call once on app mount).
 */
export function initLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored && (stored === "ru" || stored === "kk")) {
      currentLocale = stored;
    }
  }
  return currentLocale;
}

/**
 * Translate a key. Dot notation: "section.key".
 * Falls back to Russian if key not found in current locale.
 * Falls back to the key itself if not found in any locale.
 */
export function t(key: string, locale?: Locale): string {
  const loc = locale ?? currentLocale;
  const parts = key.split(".");
  if (parts.length !== 2) return key;

  const [section, field] = parts;
  const msg = messages[loc]?.[section]?.[field];
  if (msg) return msg;

  // Fallback to Russian
  if (loc !== "ru") {
    const fallback = messages.ru?.[section]?.[field];
    if (fallback) return fallback;
  }

  return key;
}
