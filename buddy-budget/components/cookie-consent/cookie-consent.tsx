"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import * as CookieConsent from "vanilla-cookieconsent";

import { cookieConsentConfig } from "./cookie-consent-config";
import "vanilla-cookieconsent/dist/cookieconsent.css";

export function CookieConsentComponent() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const initRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || initRef.current) return;

    initRef.current = true;

    // Determine current theme before initialization
    const isDarkMode = resolvedTheme === "dark";

    // Function to apply dark mode when element is ready
    const applyDarkMode = () => {
      const ccMain = document.getElementById("cc-main");

      if (ccMain) {
        if (isDarkMode) {
          ccMain.classList.add("cc--darkmode");
        }
      } else {
        // If element doesn't exist yet, try again on next frame
        requestAnimationFrame(applyDarkMode);
      }
    };

    // Initialize CookieConsent
    CookieConsent.run(cookieConsentConfig);

    // Start polling for the element
    requestAnimationFrame(applyDarkMode);
  }, [mounted, resolvedTheme]);

  // Watch for theme changes after initialization
  useEffect(() => {
    if (!mounted || !initRef.current) return;

    const isDark = resolvedTheme === "dark";
    const ccMain = document.getElementById("cc-main");

    if (ccMain) {
      if (isDark) {
        ccMain.classList.add("cc--darkmode");
      } else {
        ccMain.classList.remove("cc--darkmode");
      }
    }
  }, [resolvedTheme, mounted]);

  return null;
}
