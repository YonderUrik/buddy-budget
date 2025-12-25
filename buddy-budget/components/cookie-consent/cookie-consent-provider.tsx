"use client";

import type { CookieCategory, CookieConsentContextValue } from "./types";

import { createContext, useEffect, useState, type ReactNode } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

import { CookieConsentComponent } from "./cookie-consent";

export const CookieConsentContext = createContext<CookieConsentContextValue>({
  acceptedCategory: () => false,
  acceptedService: () => false,
  showPreferences: () => {},
  acceptedCategories: [],
});

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [acceptedCategories, setAcceptedCategories] = useState<
    CookieCategory[]
  >([]);

  useEffect(() => {
    const updateCategories = () => {
      const categories: CookieCategory[] = [
        "essential",
        "analytics",
        "marketing",
        "embeds",
      ];
      const accepted = categories.filter((cat) => {
        if (cat === "essential") {
          return CookieConsent.acceptedCategory("necessary");
        }

        return CookieConsent.acceptedCategory(cat);
      });

      setAcceptedCategories(accepted as CookieCategory[]);
    };

    updateCategories();

    window.addEventListener("cc:onChange", updateCategories);

    return () => {
      window.removeEventListener("cc:onChange", updateCategories);
    };
  }, []);

  const contextValue: CookieConsentContextValue = {
    acceptedCategory: (category: CookieCategory) => {
      if (category === "essential") {
        return CookieConsent.acceptedCategory("necessary");
      }

      return CookieConsent.acceptedCategory(category);
    },
    acceptedService: (service: string, category: CookieCategory) => {
      const ccCategory = category === "essential" ? "necessary" : category;

      return CookieConsent.acceptedService(service, ccCategory);
    },
    showPreferences: () => CookieConsent.showPreferences(),
    acceptedCategories,
  };

  return (
    <CookieConsentContext.Provider value={contextValue}>
      <CookieConsentComponent />
      {children}
    </CookieConsentContext.Provider>
  );
}
