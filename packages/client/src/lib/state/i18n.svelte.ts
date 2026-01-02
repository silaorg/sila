import { createTexts, type SupportedLanguage, type Texts } from "@sila/core";

export class i18nStore {
  private _currentLanguage: SupportedLanguage = $state(
    (typeof window !== "undefined"
      ? (localStorage.getItem("language") as SupportedLanguage) || "en"
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