"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./app-window.css";
import { Mark } from "./brand";

/** Larghezza di progetto (px) della finestra: i contenuti sono disegnati a questa misura e scalati. */
const WINDOW_DESIGN_WIDTH = 920;

export type NavKey = "pano" | "conti" | "mov" | "inv" | "pens" | "deb" | "plan" | "ana";

const NAV_ICON: Record<NavKey, ReactNode> = {
  pano: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  conti: <path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18" />,
  mov: <path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" />,
  inv: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  pens: <path d="M12 3a9 9 0 019 9H3a9 9 0 019-9zM12 12v7a2 2 0 004 0" />,
  deb: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  plan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  ana: <path d="M5 20V10M12 20V4M19 20v-7" />,
};

/** Voci della sidebar dell'app; `soon` = schermata non ancora implementata (badge "Presto"). */
const NAV_ITEMS: readonly { key: NavKey; label: string; soon?: boolean }[] = [
  { key: "pano", label: "Panoramica" },
  { key: "conti", label: "Conti" },
  { key: "mov", label: "Movimenti" },
  { key: "inv", label: "Investimenti" },
  { key: "pens", label: "Pensione", soon: true },
  { key: "deb", label: "Debiti" },
  { key: "plan", label: "Pianifica", soon: true },
  { key: "ana", label: "Analitiche", soon: true },
];

export interface AppWindowProps {
  /** Voce di navigazione evidenziata. */
  active: NavKey;
  /** Indirizzo mostrato nella barra del finto browser. */
  url: string;
  /** Schermate (elementi `.scr` posizionati in assoluto): quella con classe `on` o `live` è visibile e animata. */
  children: ReactNode;
}

/**
 * Finestra dell'app ricostruita con i token reali, scalata (con ResizeObserver) alla larghezza del contenitore.
 * Il contenuto è decorativo: lo screen reader legge solo l'etichetta.
 */
export function AppWindow({ active, url, children }: AppWindowProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      el.style.setProperty("--s", String(Math.min(1, el.clientWidth / WINDOW_DESIGN_WIDTH)));
      el.classList.add("ready");
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fit" ref={ref}>
      <div className="win" role="img" aria-label="Schermata dell'app BuddyBudget, con dati di esempio">
        <div className="wb">
          <i />
          <i />
          <i />
          <div className="url">{url}</div>
        </div>
        <div className="wm">
          <aside className="sb">
            <div className="lg">
              <Mark />
              BuddyBudget
            </div>
            {NAV_ITEMS.map((item) => (
              <div key={item.key} className={`ni${item.soon ? " dim" : ""}${item.key === active ? " on" : ""}`}>
                <svg viewBox="0 0 24 24">{NAV_ICON[item.key]}</svg>
                {item.label}
              </div>
            ))}
            <div className="sum">
              <span>Oggi</span>
              <b>47.320 €</b>
              <span>Patrimonio netto</span>
            </div>
          </aside>
          <div className="mn">{children}</div>
        </div>
      </div>
    </div>
  );
}
