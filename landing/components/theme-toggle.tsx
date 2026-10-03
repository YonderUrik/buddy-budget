"use client";

import "./theme-toggle.css";
import { track } from "@/lib/analytics";

import { THEME_STORAGE_KEY } from "@/lib/theme";

function currentTheme(): "light" | "dark" {
  const root = document.documentElement;
  if (root.dataset.theme === "dark" || root.dataset.theme === "light") return root.dataset.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Pulsante chiaro/scuro: parte dal tema del sistema, la scelta si ricorda nel browser. */
export function ThemeToggle() {
  const toggle = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage bloccato: il tema vale per questa visita
    }
    track("theme_toggled", { theme: next });
  };

  return (
    <button className="tg" type="button" onClick={toggle} aria-label="Cambia tema">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      </svg>
    </button>
  );
}
