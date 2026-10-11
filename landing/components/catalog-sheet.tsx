"use client";

import "./catalog-sheet.css";
import Link from "next/link";
import { useState } from "react";
import { FEATURE_AREAS, FEATURES, type FeatureArea, type FeatureStatus } from "@/content/catalog.generated";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { track } from "@/lib/analytics";
import { ARROW_ICON } from "./cta-link";
import { TrackedSection } from "./tracked-section";

/** Stato della funzione nella colonna «Stato», come un valore di cella. */
const STATUS_LABEL: Record<FeatureStatus, string> = { live: "ATTIVA", new: "NUOVA", soon: "PRESTO" };
/** Area mostrata all'apertura: la più usata. */
const DEFAULT_AREA: FeatureArea = "Liquidità";

/**
 * Tutte le funzioni del catalogo condiviso in una tabella, filtrabile per area come un foglio. Tutte le righe sono
 * nell'HTML (indicizzabili): il filtro nasconde quelle delle altre aree. Invia `catalog_area_selected`.
 */
export function CatalogSheet() {
  const [area, setArea] = useState<FeatureArea | "Tutte">(DEFAULT_AREA);
  const visible = FEATURES.filter((f) => area === "Tutte" || f.area === area);
  const choose = (next: FeatureArea | "Tutte") => {
    setArea(next);
    if (next !== "Tutte") track("catalog_area_selected", { area: next });
  };

  return (
    <TrackedSection id="funzioni" section="funzioni" className="sec cs">
      <div className="wrap">
        <span className="ref">Funzioni!A1:D{visible.length + 1}</span>
        <h2 className="t">Tutte le {FEATURES.length} funzioni, in una tabella.</h2>
        <div className="cs-filter" role="group" aria-label="Filtra per area">
          {(["Tutte", ...FEATURE_AREAS] as const).map((a) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => choose(a)}>{a}</button>
          ))}
        </div>
        <div className="cs-scroll">
          <table className="cs-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr">Riga</span></th>
                <th scope="col">Funzione</th>
                <th scope="col">Area</th>
                <th scope="col">Cosa fa</th>
                <th scope="col">Stato</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => {
                const row = visible.indexOf(f);
                return (
                  <tr key={f.id} hidden={row === -1}>
                    <td className="cs-n">{row + 2}</td>
                    <th scope="row">{f.name}</th>
                    <td className="cs-area">{f.area}</td>
                    <td>{f.description}</td>
                    <td className={`cs-st ${f.status}`}>{STATUS_LABEL[f.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cta" style={{ marginTop: 28 }}>
          <Link className="btn ghost" href={CONTENT_PATHS.funzioni}>Le funzioni area per area{ARROW_ICON}</Link>
          <Link className="btn ghost" href={CONTENT_PATHS.schermate}>Tutte le schermate{ARROW_ICON}</Link>
        </div>
      </div>
    </TrackedSection>
  );
}
