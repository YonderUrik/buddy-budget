"use client"

import { useEffect, useState } from "react"
import i18n from "@/i18n/config"

export default function I18nProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(i18n.isInitialized)

  useEffect(() => {
    // Ensure i18n is fully initialized on client side
    if (typeof window !== "undefined" && !isInitialized) {
      // Force language detection to run again if needed
      i18n.changeLanguage(i18n.language || navigator.language || "en")
      setIsInitialized(true)
    }
  }, [isInitialized])

  return children
} 