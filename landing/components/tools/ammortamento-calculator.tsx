"use client";

import { useState } from "react";
import { SplitBar } from "@/components/viz/viz";
import { groupThousands, groupThousandsIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { buildFrenchPlan, simulateEarlyRepayment } from "@/lib/tools/ammortamento";

const MAX_MONTHS = 600;
const eur2 = (n: number) => `${groupThousands(Math.trunc(n))},${Math.abs(Math.round((n - Math.trunc(n)) * 100)).toString().padStart(2, "0")} €`;
/** "€1,234.56": rounded to the cent first, so 0.996 reads "€1.00". */
function eur2En(n: number): string {
  const cents = Math.round(Math.abs(n) * 100);
  const sign = n < 0 && cents > 0 ? "−" : "";
  return `${sign}€${groupThousandsIn(Math.trunc(cents / 100), "en")}.${String(cents % 100).padStart(2, "0")}`;
}
const num = (s: string) => (Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : 0);
/** English decimals use the point, and a comma only groups thousands ("100,000"). */
const numEn = (s: string) => (Number.isFinite(Number(s.replace(/,/g, ""))) ? Number(s.replace(/,/g, "")) : 0);

/** Visible texts of the calculator in one language. */
interface AmmortamentoText {
  loan: string;
  principal: string;
  rate: string;
  years: string;
  plan: string;
  barPrincipal: string;
  barInterest: string;
  installment: string;
  totalInterest: string;
  totalPaid: string;
  count: string;
  invalid: string;
  earlyTitle: string;
  after: string;
  extra: string;
  penaltyField: string;
  interestSaved: string;
  penalty: string;
  netSaving: string;
  monthsLeft: string;
  newInstallment: string;
  schedule: string;
  columns: readonly [string, string, string, string];
  parse: (s: string) => number;
  amount: (n: number) => string;
}

const TEXT: Record<Locale, AmmortamentoText> = {
  it: {
    loan: "Il finanziamento",
    principal: "Importo (€)",
    rate: "Tasso nominale annuo, TAN (%)",
    years: "Durata (anni)",
    plan: "Il piano",
    barPrincipal: "Capitale",
    barInterest: "Interessi",
    installment: "Rata mensile",
    totalInterest: "Interessi totali",
    totalPaid: "Totale pagato",
    count: "Numero di rate",
    invalid: "Inserisci un importo e un tasso validi.",
    earlyTitle: "E se estinguo una parte in anticipo?",
    after: "Dopo quanti anni (dall'inizio)",
    extra: "Capitale estinto (€)",
    penaltyField: "Penale sul capitale estinto (%, di solito 0 per i mutui sull'abitazione)",
    interestSaved: "Interessi risparmiati",
    penalty: "Penale",
    netSaving: "Risparmio netto",
    monthsLeft: "Stessa rata: rate che restano",
    newInstallment: "Stessa durata: nuova rata",
    schedule: "Piano di ammortamento completo",
    columns: ["Rata", "Quota capitale", "Quota interessi", "Debito residuo"],
    parse: num,
    amount: eur2,
  },
  en: {
    loan: "The loan",
    principal: "Amount (€)",
    rate: "Nominal annual rate, TAN (%)",
    years: "Term (years)",
    plan: "The schedule",
    barPrincipal: "Principal",
    barInterest: "Interest",
    installment: "Monthly payment",
    totalInterest: "Total interest",
    totalPaid: "Total paid",
    count: "Number of payments",
    invalid: "Enter a valid amount and rate.",
    earlyTitle: "What if I pay off part of it early?",
    after: "After how many years (from the start)",
    extra: "Principal paid off (€)",
    penaltyField: "Penalty on the principal paid off (%, usually 0 for a home mortgage in Italy)",
    interestSaved: "Interest saved",
    penalty: "Penalty",
    netSaving: "Net saving",
    monthsLeft: "Same payment: payments left",
    newInstallment: "Same term: new payment",
    schedule: "Full amortization schedule",
    columns: ["Payment", "Principal", "Interest", "Balance left"],
    parse: numEn,
    amount: eur2En,
  },
};

export interface AmmortamentoCalculatorProps {
  /** Language of the labels and of the amounts. */
  locale?: Locale;
}

/** Fixed-payment (French) amortization calculator, with a partial early repayment. */
export function AmmortamentoCalculator({ locale = "it" }: AmmortamentoCalculatorProps) {
  const t = TEXT[locale];
  const parse = t.parse;
  const fmt = t.amount;
  const [principal, setPrincipal] = useState("100000");
  const [rate, setRate] = useState("3");
  const [years, setYears] = useState("20");
  const [after, setAfter] = useState("5");
  const [extra, setExtra] = useState("20000");
  const [penalty, setPenalty] = useState("0");
  const months = Math.min(MAX_MONTHS, Math.max(1, Math.round(parse(years) * 12)));
  const P = Math.max(0, parse(principal));
  const valid = P > 0 && parse(rate) >= 0;
  const plan = valid ? buildFrenchPlan(P, parse(rate), months) : null;
  const afterMonths = Math.min(months - 1, Math.max(1, Math.round(parse(after) * 12)));
  const early = valid && months > 1 ? simulateEarlyRepayment({ principal: P, annualRatePct: parse(rate), months, afterMonths, extra: Math.max(0, parse(extra)), penaltyPct: Math.max(0, parse(penalty)) }) : null;

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>{t.loan}</h2>
          <div className="field"><label htmlFor="a-p">{t.principal}</label><input id="a-p" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-r">{t.rate}</label><input id="a-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-y">{t.years}</label><input id="a-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>{t.plan}</h2>
          {plan ? (
            <div className="res">
              <SplitBar parts={[{ label: t.barPrincipal, value: P, tone: "pos" }, { label: t.barInterest, value: plan.totalInterest, tone: "neg" }]} />
              <div className="row key"><span>{t.installment}</span><b>{fmt(plan.installment)}</b></div>
              <div className="row"><span>{t.totalInterest}</span><b>{fmt(plan.totalInterest)}</b></div>
              <div className="row"><span>{t.totalPaid}</span><b>{fmt(plan.totalPaid)}</b></div>
              <div className="row"><span>{t.count}</span><b>{months}</b></div>
            </div>
          ) : (
            <p>{t.invalid}</p>
          )}
        </div>
      </div>
      <h2>{t.earlyTitle}</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="e-a">{t.after}</label><input id="e-a" inputMode="decimal" value={after} onChange={(e) => setAfter(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-x">{t.extra}</label><input id="e-x" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-p">{t.penaltyField}</label><input id="e-p" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {early ? (
            <div className="res">
              <div className="row"><span>{t.interestSaved}</span><b>{fmt(early.interestSaved)}</b></div>
              <div className="row"><span>{t.penalty}</span><b>{early.penalty > 0 ? "−" : ""}{fmt(early.penalty)}</b></div>
              <div className="row key"><span>{t.netSaving}</span><b>{fmt(early.netSaving)}</b></div>
              <div className="row"><span>{t.monthsLeft}</span><b>{early.monthsLeftSameInstallment}</b></div>
              <div className="row"><span>{t.newInstallment}</span><b>{fmt(early.newInstallmentSameTerm)}</b></div>
            </div>
          ) : null}
        </div>
      </div>
      {plan ? (
        <div className="sched" tabIndex={0} role="region" aria-label={t.schedule}>
          <table>
            <thead><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.n}><td>{row.n}</td><td>{fmt(row.principal)}</td><td>{fmt(row.interest)}</td><td>{fmt(row.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
