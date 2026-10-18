"use client";

import { useState } from "react";
import { SplitBar } from "@/components/viz/viz";
import { eur, money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { computeZainetto, ZAINETTO_RATES, type LossInput, type ZainettoInstrument } from "@/lib/tools/zainetto";

const TAX_YEAR = 2026;
interface LossField { year: string; amount: string }
const EXAMPLE: LossField[] = [{ year: "2023", amount: "1500" }, { year: "2025", amount: "2000" }];

/** Visible texts of the calculator in one language. */
interface ZainettoText {
  inputs: string;
  instrument: string;
  instrumentGroup: string;
  instruments: Record<ZainettoInstrument, string>;
  gain: (year: number) => string;
  losses: string;
  lossYear: (n: number) => string;
  lossAmount: (n: number) => string;
  removeLoss: (n: number) => string;
  addLoss: string;
  result: string;
  offset: string;
  taxed: string;
  rowGain: string;
  rowOffset: string;
  rowTaxable: string;
  rowTax: (rate: string) => string;
  rowSaved: string;
  rowRemaining: string;
  expired: string;
  usableUntil: (year: number) => string;
  /** Rate as written in the page language («12,5», "12.5"). */
  rate: (pct: number) => string;
  /** Typed amount to a number: English accepts "3,000". */
  parse: (s: string) => number;
  amount: (n: number) => string;
}

const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

const TEXT: Record<Locale, ZainettoText> = {
  it: {
    inputs: "I tuoi dati",
    instrument: "Strumento venduto",
    instrumentGroup: "Strumento",
    instruments: { azioni_etf: "Azioni e ETF", titoli_stato: "Titoli di Stato" },
    gain: (year) => `Plusvalenza realizzata nel ${year} (€)`,
    losses: "Minusvalenze degli anni precedenti",
    lossYear: (n) => `Anno della minusvalenza ${n}`,
    lossAmount: (n) => `Importo della minusvalenza ${n} (€)`,
    removeLoss: (n) => `Rimuovi la minusvalenza ${n}`,
    addLoss: "+ Aggiungi minusvalenza",
    result: "Risultato (stima)",
    offset: "Compensata dalle minusvalenze",
    taxed: "Su cui paghi l'imposta",
    rowGain: "Plusvalenza",
    rowOffset: "Minusvalenze compensate",
    rowTaxable: "Base imponibile",
    rowTax: (rate) => `Imposta (${rate}%)`,
    rowSaved: "Imposta risparmiata",
    rowRemaining: "Minusvalenze ancora riportabili",
    expired: "scaduta",
    usableUntil: (year) => `utilizzabile fino al ${year}`,
    rate: (pct) => String(pct).replace(".", ","),
    parse: num,
    amount: eur,
  },
  en: {
    inputs: "Your numbers",
    instrument: "What you sold",
    instrumentGroup: "Instrument",
    instruments: { azioni_etf: "Stocks and ETFs", titoli_stato: "Government bonds" },
    gain: (year) => `Capital gain made in ${year} (€)`,
    losses: "Capital losses from earlier years",
    lossYear: (n) => `Year of loss ${n}`,
    lossAmount: (n) => `Amount of loss ${n} (€)`,
    removeLoss: (n) => `Remove loss ${n}`,
    addLoss: "+ Add a loss",
    result: "Result (estimate)",
    offset: "Offset by your losses",
    taxed: "Taxed",
    rowGain: "Capital gain",
    rowOffset: "Losses offset",
    rowTaxable: "Taxable amount",
    rowTax: (rate) => `Tax (${rate}%)`,
    rowSaved: "Tax saved",
    rowRemaining: "Losses you can still carry forward",
    expired: "expired",
    usableUntil: (year) => `usable until ${year}`,
    rate: (pct) => String(pct),
    parse: (s) => num(s.replace(/,/g, "")),
    amount: (n) => money(n, "en"),
  },
};

export interface ZainettoCalculatorProps {
  /** Language of the labels and of the amounts. */
  locale?: Locale;
}

/** Zainetto fiscale calculator: this year's capital gain, the losses of earlier years, the estimated tax. Italian tax law in both languages. */
export function ZainettoCalculator({ locale = "it" }: ZainettoCalculatorProps) {
  const t = TEXT[locale];
  const [instrument, setInstrument] = useState<ZainettoInstrument>("azioni_etf");
  const [gain, setGain] = useState("3000");
  const [losses, setLosses] = useState<LossField[]>(EXAMPLE);
  const parsed: LossInput[] = losses.map((l) => ({ year: Math.round(num(l.year)), amount: t.parse(l.amount) }));
  const r = computeZainetto({ taxYear: TAX_YEAR, gain: t.parse(gain), instrument, losses: parsed });
  const rate = t.rate(ZAINETTO_RATES[instrument]);
  const fmt = t.amount;

  return (
    <div className="tool">
      <div className="tool-card">
        <h2>{t.inputs}</h2>
        <div className="field">
          <span className="lab">{t.instrument}</span>
          <div className="seg" role="group" aria-label={t.instrumentGroup}>
            {(Object.keys(t.instruments) as ZainettoInstrument[]).map((id) => (
              <button key={id} type="button" aria-pressed={id === instrument} onClick={() => setInstrument(id)}>{t.instruments[id]}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="z-gain">{t.gain(TAX_YEAR)}</label>
          <input id="z-gain" inputMode="decimal" value={gain} onChange={(e) => setGain(e.target.value)} />
        </div>
        <div className="field">
          <span className="lab">{t.losses}</span>
          {losses.map((l, i) => (
            <div key={i} className="loss-row">
              <input aria-label={t.lossYear(i + 1)} inputMode="numeric" value={l.year} onChange={(e) => setLosses(losses.map((x, k) => (k === i ? { ...x, year: e.target.value } : x)))} />
              <input aria-label={t.lossAmount(i + 1)} inputMode="decimal" value={l.amount} onChange={(e) => setLosses(losses.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
              <button type="button" aria-label={t.removeLoss(i + 1)} onClick={() => setLosses(losses.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setLosses([...losses, { year: String(TAX_YEAR - 1), amount: "" }])}>{t.addLoss}</button>
        </div>
      </div>
      <div className="tool-card" aria-live="polite">
        <h2>{t.result}</h2>
        <SplitBar parts={[{ label: t.offset, value: r.compensated, tone: "pos" }, { label: t.taxed, value: r.taxableGain, tone: "acc" }]} />
        <div style={{ height: 16 }} />
        <div className="res">
          <div className="row"><span>{t.rowGain}</span><b>{fmt(r.gain)}</b></div>
          <div className="row"><span>{t.rowOffset}</span><b>−{fmt(r.compensated)}</b></div>
          <div className="row"><span>{t.rowTaxable}</span><b>{fmt(r.taxableGain)}</b></div>
          <div className="row key"><span>{t.rowTax(rate)}</span><b>{fmt(r.tax)}</b></div>
          <div className="row good"><span>{t.rowSaved}</span><b>{fmt(r.taxSaved)}</b></div>
          <div className="row"><span>{t.rowRemaining}</span><b>{fmt(r.remaining)}</b></div>
        </div>
        <div className="chips">
          {r.losses.map((l, i) => (
            <span key={i} className={`chip ${l.expired ? "off" : "on"}`}>
              {l.year}: {l.expired ? t.expired : t.usableUntil(l.expiresYear)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
