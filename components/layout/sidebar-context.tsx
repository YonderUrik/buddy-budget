"use client";

/**
 * SidebarContext
 *
 * Gestisce lo stato globale della sidebar dell'applicazione:
 * - `collapsed`: sidebar icon-only (desktop/tablet)
 * - `mobileOpen`: drawer visibile su mobile
 *
 * Lo stato `collapsed` viene persistito in localStorage per sopravvivere
 * ai refresh di pagina. `mobileOpen` è volatile (resettato al mount).
 *
 * Usa l'hook `useSidebar()` per accedere a questi valori nei componenti figli.
 * Il Context è standalone: non ha dipendenze dall'app router o dal dominio,
 * ed è riutilizzabile in qualsiasi layout Next.js.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface SidebarState {
  /** True quando la sidebar è in modalità icon-only (desktop collassata). */
  collapsed: boolean;
  /** True quando il drawer mobile è aperto. */
  mobileOpen: boolean;
  /** Alterna collapsed ↔ expanded (desktop). */
  toggleCollapsed: () => void;
  /** Apre il drawer mobile. */
  openMobile: () => void;
  /** Chiude il drawer mobile. */
  closeMobile: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SidebarContext = createContext<SidebarState | null>(null);

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

/** Larghezza minima (px) sopra la quale la sidebar è visibile in desktop mode. */
const BREAKPOINT_MD = 768;
/** Larghezza minima (px) per cui la sidebar è espandibile manualmente. */
const BREAKPOINT_LG = 1024;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const STORAGE_KEY = "buddybudget:sidebar:collapsed";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Inizializzazione lazy: legge localStorage solo lato client.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Sincronizza il valore di collapsed in localStorage ogni volta che cambia.
  // Solo se siamo su desktop (≥ lg): su tablet è gestito automaticamente,
  // non vogliamo sovrascrivere la preferenza desktop dell'utente.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= BREAKPOINT_LG) {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  }, [collapsed]);

  // Auto-collasso su tablet (md–lg): forza icon-only quando la viewport
  // è nel range 768–1023px, ripristina la preferenza desktop sopra 1024px.
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= BREAKPOINT_MD && w < BREAKPOINT_LG) {
        // Tablet: forza collapsed senza toccare localStorage
        setCollapsed(true);
      } else if (w >= BREAKPOINT_LG) {
        // Desktop: ripristina la preferenza salvata
        const saved = localStorage.getItem(STORAGE_KEY) === "true";
        setCollapsed(saved);
      }
    };

    // Esegui subito al mount per inizializzare correttamente in base alla viewport.
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider
      value={{ collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook per accedere allo stato della sidebar.
 * Deve essere usato all'interno di un `<SidebarProvider>`.
 */
export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a <SidebarProvider>");
  }
  return ctx;
}
