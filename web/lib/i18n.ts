import "server-only";
import { cookies } from "next/headers";

import { en, type Dict } from "./dictionaries/en";
import { zhHant } from "./dictionaries/zh-Hant";
import { zhHans } from "./dictionaries/zh-Hans";

/**
 * Cookie-based i18n with no URL change. A `NEXT_LOCALE` cookie chooses the
 * language; server components read it and pick the dictionary + localized
 * registry content. The client LanguageSwitcher writes the cookie and calls
 * router.refresh() to re-render. Reading the cookie makes pages dynamic — fine
 * for a small site whose data comes from a committed snapshot.
 */

export const LOCALES = ["en", "zh-Hant", "zh-Hans"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-Hant": "繁體中文",
  "zh-Hans": "简体中文",
};

// Compact labels for the header switcher.
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  "zh-Hant": "繁",
  "zh-Hans": "简",
};

const DICTS: Record<Locale, Dict> = {
  en,
  "zh-Hant": zhHant,
  "zh-Hans": zhHans,
};

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

/** Locale metadata to hand to the (client) switcher, which can't import server-only. */
export function localeOptions(): { value: Locale; short: string; label: string }[] {
  return LOCALES.map((l) => ({ value: l, short: LOCALE_SHORT[l], label: LOCALE_LABELS[l] }));
}

export type { Dict };
