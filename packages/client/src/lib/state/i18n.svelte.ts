import { createTexts, SUPPORTED_LANGUAGES, type SupportedLanguage, type Texts } from "@sila/core";

function normalizeLocaleTag(locale: string): string {
  return locale.trim().toLowerCase().replaceAll("_", "-");
}

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

export function getDefaultLanguage(): SupportedLanguage {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [
    ...(navigator.languages ?? []),
    // Keep `navigator.language` as a last-resort fallback.
    // It can be missing in some embedded environments.
    navigator.language
  ].filter(Boolean);

  for (const raw of candidates) {
    const normalized = normalizeLocaleTag(raw);

    // Full match (in case we ever support tags like "pt-br")
    if (isSupportedLanguage(normalized)) {
      return normalized;
    }

    // Region/script fallback: "en-us" -> "en"
    const base = normalized.split("-")[0];
    if (base && isSupportedLanguage(base)) {
      return base;
    }
  }

  return "en";
}

function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("language");
  if (!stored) return null;

  const normalized = normalizeLocaleTag(stored);
  if (isSupportedLanguage(normalized)) return normalized;

  const base = normalized.split("-")[0];
  if (base && isSupportedLanguage(base)) return base;

  return null;
}

export class i18nStore {
  private _currentLanguage: SupportedLanguage = $state(
    (typeof window !== "undefined"
      ? getStoredLanguage() || getDefaultLanguage()
      : "en")
  );

  texts: Texts = $derived(createTexts(this._currentLanguage));

  get language(): SupportedLanguage {
    return this._currentLanguage;
  }

  set language(lang: SupportedLanguage) {
    this._currentLanguage = lang;
    // Persist to localStorage immediately
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
  }
}

export const i18n = new i18nStore();