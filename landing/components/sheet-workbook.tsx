"use client";

import "./app-shot.css";
import "./sheet-workbook.css";
import { useState } from "react";
import { SCREEN_THEMES, screenSrc } from "@/content/screens";
import type { SHEET_HERO } from "@/content/sheet";
import { track } from "@/lib/analytics";

/** Lettere delle colonne del foglio, nell'ordine di `content.columns`. */
const COLUMN_LETTERS = ["A", "B", "C", "D"] as const;
/** Dimensioni intrinseche degli screenshot (vedi `scripts/capture-screens.mjs`). */
const SHOT_SIZE = { width: 1920, height: 1200 } as const;

type View = "foglio" | "app";

/**
 * Il foglio di calcolo d'esempio (errori di formula, date vecchie, note a margine) con due schede in basso: «Foglio1»
 * e «BuddyBudget». La seconda dissolve il foglio nella Panoramica vera, con gli stessi conti. Invia `sheet_view_toggled`.
 */
export function SheetWorkbook({ content }: { content: typeof SHEET_HERO }) {
  const [view, setView] = useState<View>("foglio");
  const choose = (next: View) => {
    if (next === view) return;
    setView(next);
    track("sheet_view_toggled", { view: next });
  };

  return (
    <div className={`wb cell${view === "app" ? " is-app" : ""}`}>
      <div className="wb-file">
        <span>{content.fileName}</span>
        <span className="wb-age">{content.fileAge}</span>
      </div>
      <div className="wb-fx" aria-hidden="true">
        <span>{content.formulaCell}</span>
        <code>{content.formula}</code>
      </div>
      <div className="wb-body">
        <table className="wb-sheet" aria-label="Foglio di calcolo d'esempio, con i conti tenuti a mano">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {COLUMN_LETTERS.map((l) => (
                <th key={l} scope="col" className={l === "D" ? "wb-d" : undefined}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="wb-head">
              <td>1</td>
              {content.columns.map((c, i) => (
                <td key={c} className={`${i > 0 && i < 3 ? "n" : ""}${i === 3 ? " wb-d" : ""}`}>{c}</td>
              ))}
            </tr>
            {content.rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 2}</td>
                <td>{r.label}</td>
                <td className={r.error ? "n err" : "n"}>{r.value}</td>
                <td className="n">{r.updated}</td>
                <td className="wb-d">{r.note}</td>
              </tr>
            ))}
            <tr className="wb-total">
              <td>{content.rows.length + 2}</td>
              <td>{content.totalLabel}</td>
              <td className="n err wb-sel">{content.totalValue}</td>
              <td />
              <td className="wb-d" />
            </tr>
          </tbody>
        </table>
        <div className="wb-app" aria-hidden={view !== "app"}>
          {SCREEN_THEMES.map((theme) => (
            // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
            <img key={theme} className={`shot-img shot-${theme}`} src={screenSrc("panoramica", theme)} alt={content.appAlt} width={SHOT_SIZE.width} height={SHOT_SIZE.height} loading="eager" decoding="async" />
          ))}
        </div>
      </div>
      <div className="wb-tabs" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === "foglio"} onClick={() => choose("foglio")}>{content.sheetTab}</button>
        <button type="button" aria-pressed={view === "app"} onClick={() => choose("app")}>{content.appTab}</button>
      </div>
    </div>
  );
}
