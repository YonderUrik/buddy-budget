"use client"

import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
// Import translations
import enTranslation from "./locales/en.json"
import itTranslation from "./locales/it.json"
const resources = {
  en: {
    translation: enTranslation,
  },
  it: {
    translation: itTranslation,
  },
}

// Don't initialize automatically on import
const i18nInstance = i18n
  .use(LanguageDetector)
  .use(initReactI18next)

// Only initialize if it hasn't been initialized yet
if (!i18n.isInitialized) {
  i18nInstance.init({
    resources,
    // fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  })
}

export default i18n

