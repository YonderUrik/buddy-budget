"use client";

import "./app-shot.css";
import "./sheet-workbook.css";
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SCREEN_THEMES, screenSrc } from "@/content/screens";
import type { SHEET_HERO } from "@/content/sheet";
import { track } from "@/lib/analytics";

/** Lettere delle colonne del foglio, nell'ordine di `content.columns`. */
const COLUMN_LETTERS = ["A", "B", "C", "D"] as const;
/** Dimensioni intrinseche della parte alta della Panoramica (vedi `scripts/capture-screens.mjs`). */
const SHOT_SIZE = { width: 1920, height: 1200 } as const;

type View = "foglio" | "app";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Quanto resta ogni vista prima del cambio automatico (ms): il foglio meno, l'app un po' di più per leggerla. */
const AUTO_MS: Record<View, number> = { foglio: 3800, app: 5200 };

/**
 * Il foglio di calcolo d'esempio (errori di formula, date vecchie, note a margine) con due schede in basso: «Foglio1»
 * e «BuddyBudget». Le due viste si alternano da sole (la barra che si riempie sotto la scheda attiva dice quando cambia),
 * si fermano al passaggio del mouse o fuori schermo e smettono del tutto al primo clic; con «riduci movimento» non
 * partono. Il passaggio all'app parte dalla cella del totale, che si allarga nella Panoramica. Invia `sheet_view_toggled` solo per i cambi scelti dall'utente.
 */
export function SheetWorkbook({ content }: { content: typeof SHEET_HERO }) {
  const [view, setView] = useState<View>("app");
  const [stopped, setStopped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);
  // Il giro automatico parte solo se l'utente non ha chiesto meno movimento (sul server: fermo).
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => true);
  const auto = !reduced && !stopped;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // La schermata parte ritagliata sulla cella del totale (B12) e si allarga fino a riempire il foglio: qui si misura
  // dove sta la cella, in variabili CSS sul contenitore (niente stato React, cambia solo al ridimensionamento).
  useEffect(() => {
    const body = bodyRef.current;
    const cell = cellRef.current;
    if (!body || !cell) return;
    const measure = () => {
      const b = body.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      body.style.setProperty("--ct", `${c.top - b.top}px`);
      body.style.setProperty("--cl", `${c.left - b.left}px`);
      body.style.setProperty("--cr", `${b.right - c.right}px`);
      body.style.setProperty("--cb", `${b.bottom - c.bottom}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  const choose = (next: View) => {
    setStopped(true);
    if (next === view) return;
    setView(next);
    track("sheet_view_toggled", { view: next });
  };
  const running = auto && visible && !paused;

  return (
    <div
      ref={ref}
      className={`wb cell${view === "app" ? " is-app" : ""}`}
      // Pausa solo col mouse: su un telefono il tocco non ha un «uscire» e il giro resterebbe fermo.
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="wb-file">
        <span>{view === "app" ? content.appFile : content.fileName}</span>
        <span className="wb-age">{view === "app" ? content.appAge : content.fileAge}</span>
      </div>
      <div className="wb-fx" aria-hidden="true">
        <span>{content.formulaCell}</span>
        <code className={view === "app" ? "wb-fx-ok" : undefined}>{view === "app" ? content.appFormula : content.formula}</code>
      </div>
      <div className="wb-body" ref={bodyRef}>
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
            <tr className="wb-head" style={{ "--i": 0 } as CSSProperties}>
              <td>1</td>
              {content.columns.map((c, i) => (
                <td key={c} className={`${i > 0 && i < 3 ? "n" : ""}${i === 3 ? " wb-d" : ""}`}>{c}</td>
              ))}
            </tr>
            {content.rows.map((r, i) => (
              <tr key={i} style={{ "--i": i + 1 } as CSSProperties}>
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
              <td ref={cellRef} className="n err wb-sel">{content.totalValue}</td>
              <td />
              <td className="wb-d" />
            </tr>
          </tbody>
        </table>
        <div className="wb-app" aria-hidden={view !== "app"}>
          {SCREEN_THEMES.map((theme) => (
            // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
            <img key={theme} className={`shot-img shot-${theme}`} src={screenSrc("panoramica", theme, true)} alt={content.appAlt} width={SHOT_SIZE.width} height={SHOT_SIZE.height} loading="eager" decoding="async" />
          ))}
        </div>
      </div>
      <div className="wb-tabs" role="group" aria-label="Vista">
        {(["foglio", "app"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => choose(v)}>
            {v === "foglio" ? content.sheetTab : content.appTab}
            {auto && view === v && (
              // La barra si riempie nel tempo della vista; alla fine dell'animazione si passa all'altra.
              <span
                className="wb-progress"
                aria-hidden="true"
                style={{ animationDuration: `${AUTO_MS[v]}ms`, animationPlayState: running ? "running" : "paused" }}
                onAnimationEnd={() => setView(v === "foglio" ? "app" : "foglio")}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
