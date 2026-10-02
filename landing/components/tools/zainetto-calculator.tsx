"use client";

import { useState } from "react";
import { eur } from "@/lib/format";
import { computeZainetto, ZAINETTO_RATES, type LossInput, type ZainettoInstrument } from "@/lib/tools/zainetto";

const TAX_YEAR = 2026;
const INSTRUMENTS: readonly { id: ZainettoInstrument; label: string }[] = [
  { id: "azioni_etf", label: "Azioni e ETF" },
  { id: "titoli_stato", label: "Titoli di Stato" },
];
interface LossField { year: string; amount: string }
const EXAMPLE: LossField[] = [{ year: "2023", amount: "1500" }, { year: "2025", amount: "2000" }];

const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

/** Calcolatore dello zainetto fiscale: plusvalenza dell'anno, minusvalenze degli anni precedenti, imposta stimata. */
export function ZainettoCalculator() {
  const [instrument, setInstrument] = useState<ZainettoInstrument>("azioni_etf");
  const [gain, setGain] = useState("3000");
  const [losses, setLosses] = useState<LossField[]>(EXAMPLE);
  const parsed: LossInput[] = losses.map((l) => ({ year: Math.round(num(l.year)), amount: num(l.amount) }));
  const r = computeZainetto({ taxYear: TAX_YEAR, gain: num(gain), instrument, losses: parsed });
  const rate = String(ZAINETTO_RATES[instrument]).replace(".", ",");

  return (
    <div className="tool">
      <div className="tool-card">
        <h2>I tuoi dati</h2>
        <div className="field">
          <span className="lab">Strumento venduto</span>
          <div className="seg" role="group" aria-label="Strumento">
            {INSTRUMENTS.map((i) => (
              <button key={i.id} type="button" aria-pressed={i.id === instrument} onClick={() => setInstrument(i.id)}>{i.label}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="z-gain">Plusvalenza realizzata nel {TAX_YEAR} (€)</label>
          <input id="z-gain" inputMode="decimal" value={gain} onChange={(e) => setGain(e.target.value)} />
        </div>
        <div className="field">
          <span className="lab">Minusvalenze degli anni precedenti</span>
          {losses.map((l, i) => (
            <div key={i} className="loss-row">
              <input aria-label={`Anno della minusvalenza ${i + 1}`} inputMode="numeric" value={l.year} onChange={(e) => setLosses(losses.map((x, k) => (k === i ? { ...x, year: e.target.value } : x)))} />
              <input aria-label={`Importo della minusvalenza ${i + 1} (€)`} inputMode="decimal" value={l.amount} onChange={(e) => setLosses(losses.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
              <button type="button" aria-label={`Rimuovi la minusvalenza ${i + 1}`} onClick={() => setLosses(losses.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setLosses([...losses, { year: String(TAX_YEAR - 1), amount: "" }])}>+ Aggiungi minusvalenza</button>
        </div>
      </div>
      <div className="tool-card" aria-live="polite">
        <h2>Risultato (stima)</h2>
        <div className="res">
          <div className="row"><span>Plusvalenza</span><b>{eur(r.gain)}</b></div>
          <div className="row"><span>Minusvalenze compensate</span><b>−{eur(r.compensated)}</b></div>
          <div className="row"><span>Base imponibile</span><b>{eur(r.taxableGain)}</b></div>
          <div className="row key"><span>Imposta ({rate}%)</span><b>{eur(r.tax)}</b></div>
          <div className="row good"><span>Imposta risparmiata</span><b>{eur(r.taxSaved)}</b></div>
          <div className="row"><span>Minusvalenze ancora riportabili</span><b>{eur(r.remaining)}</b></div>
        </div>
        <div className="chips">
          {r.losses.map((l, i) => (
            <span key={i} className={`chip ${l.expired ? "off" : "on"}`}>
              {l.year}: {l.expired ? "scaduta" : `utilizzabile fino al ${l.expiresYear}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
