import { englishTexts } from "./englishTexts";
import { russianTexts } from "./ai-generated/russianTexts";
import { turkishTexts } from "./ai-generated/turkishTexts";
import { chineseTexts } from "./ai-generated/chineseTexts";
import { hindiTexts } from "./ai-generated/hindiTexts";
import { spanishTexts } from "./ai-generated/spanishTexts";
import { arabicTexts } from "./ai-generated/arabicTexts";
import { japaneseTexts } from "./ai-generated/japaneseTexts";
import { koreanTexts } from "./ai-generated/koreanTexts";
import { indonesianTexts } from "./ai-generated/indonesianTexts";
import { malayTexts } from "./ai-generated/malayTexts";
import { thaiTexts } from "./ai-generated/thaiTexts";
import { vietnameseTexts } from "./ai-generated/vietnameseTexts";
import type { Texts } from "./texts";

export const SUPPORTED_LANGUAGES = [
  "ar",
  "en",
  "es",
  "hi",
  "id",
  "ja",
  "ko",
  "ms",
  "ru",
  "th",
  "tr",
  "vi",
  "zh"
] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  ar: "Arabic / العربية",
  en: "English",
  es: "Spanish / Español",
  hi: "Hindi / हिन्दी",
  id: "Indonesian / Bahasa Indonesia",
  ja: "Japanese / 日本語",
  ko: "Korean / 한국어",
  ms: "Malay / Bahasa Melayu",
  ru: "Russian / Русский",
  th: "Thai / ไทย",
  tr: "Turkish / Türkçe",
  vi: "Vietnamese / Tiếng Việt",
  zh: "Chinese / 中文"
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T) ?? base;
  }

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value)
      ? deepMerge(existing, value)
      : value;
  }

  return out as T;
}

export function createTexts(lang: SupportedLanguage = "en"): Texts {
  if (lang === "en") {
    return englishTexts;
  }

  const localizedTexts = (() => {
    switch (lang) {
      case "ar":
        return arabicTexts;
      case "es":
        return spanishTexts;
      case "hi":
        return hindiTexts;
      case "id":
        return indonesianTexts;
      case "ja":
        return japaneseTexts;
      case "ko":
        return koreanTexts;
      case "ms":
        return malayTexts;
      case "ru":
        return russianTexts;
      case "th":
        return thaiTexts;
      case "tr":
        return turkishTexts;
      case "vi":
        return vietnameseTexts;
      case "zh":
        return chineseTexts;
      default:
        return englishTexts;
    }
  })();

  // Use English as base and override with localized texts (deeply, so missing nested keys fall back to English)
  return deepMerge(englishTexts, localizedTexts);
}
