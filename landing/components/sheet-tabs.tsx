"use client";

import "./sheet-tabs.css";
import { useEffect, useState } from "react";

/** Ancora dell'apertura della home. */
const TOP_ID = "top";

export interface SheetTab {
  /** Id della sezione della pagina (ancora). */
  id: string;
  label: string;
}

/**
 * Le sezioni della home come schede in fondo a un foglio di calcolo, ferme sotto la barra in alto. La scheda della
 * sezione che si sta leggendo resta evidenziata.
 */
export function SheetTabs({ tabs }: { tabs: readonly SheetTab[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    // L'apertura (#top) è osservata anche se non ha una scheda: tornando su, nessuna scheda resta evidenziata.
    const ids = [TOP_ID, ...tabs.map((t) => t.id)];
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav className="stabs" aria-label="Sezioni della pagina">
      <div className="wrap">
        {tabs.map((t) => (
          <a key={t.id} href={`#${t.id}`} aria-current={active === t.id ? "true" : undefined}>{t.label}</a>
        ))}
      </div>
    </nav>
  );
}
