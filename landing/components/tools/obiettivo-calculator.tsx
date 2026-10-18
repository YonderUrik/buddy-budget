"use client";

import { useState, useSyncExternalStore } from "react";
import { SplitBar } from "@/components/viz/viz";
import { groupThousands, money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { monthlyForTarget, planTarget } from "@/lib/tools/obiettivo";

/** Orizzonte massimo (anni) per «entro quando». */
const MAX_YEARS = 100;

const eur0 = (n: number) => `${groupThousands(n)} €`;
const num = (s: string) => (Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : 0);
/** English decimals use the point, and a comma only groups thousands ("20,000"). */
const numEn = (s: string) => (Number.isFinite(Number(s.replace(/,/g, ""))) ? Number(s.replace(/,/g, "")) : 0);

/** «4 anni e 2 mesi», «11 mesi», «1 anno». */
function yearsAndMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y > 0 ? `${y} ${y === 1 ? "anno" : "anni"}` : "", m > 0 ? `${m} ${m === 1 ? "mese" : "mesi"}` : ""].filter(Boolean);
  return parts.join(" e ") || "0 mesi";
}

/** "4 years and 2 months", "11 months", "1 year". */
function yearsAndMonthsEn(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y > 0 ? `${y} ${y === 1 ? "year" : "years"}` : "", m > 0 ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean);
  return parts.join(" and ") || "0 months";
}

/** La data di oggi, letta solo nel browser: la pagina è statica e il mese di arrivo non deve essere quello della build. */
let todayInBrowser: Date | null = null;
const subscribeNothing = () => () => {};
function useToday(): Date | null {
  return useSyncExternalStore(subscribeNothing, () => (todayInBrowser ??= new Date()), () => null);
}

/** Month and year of arrival from today, in the page language («giugno 2031», "June 2031"). */
function arrivalLabel(from: Date, months: number, dateLocale: string): string {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return d.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
}

/** Visible texts of the calculator in one language. */
interface ObiettivoText {
  goal: string;
  target: string;
  start: string;
  monthly: string;
  rate: string;
  when: string;
  noTarget: string;
  already: string;
  unreachable: (years: number) => string;
  barStart: string;
  barContributed: string;
  barGrowth: string;
  reachedIn: string;
  around: string;
  /** Shown before the browser has read today's date. */
  inMonths: (months: number) => string;
  contributed: string;
  growth: string;
  byDate: string;
  within: string;
  noHorizon: string;
  needed: string;
  overMonths: (months: number) => string;
  /** Written after the total paid in («versati», "deposited"). */
  paidInSuffix: string;
  /** Locale of `toLocaleDateString`. */
  dateLocale: string;
  duration: (months: number) => string;
  parse: (s: string) => number;
  amount: (n: number) => string;
}

const TEXT: Record<Locale, ObiettivoText> = {
  it: {
    goal: "L'obiettivo",
    target: "Cifra da raggiungere (€)",
    start: "Quanto hai già (€)",
    monthly: "Quanto metti da parte ogni mese (€)",
    rate: "Rendimento annuo (%, 0 se resta sul conto)",
    when: "Quando ci arrivi",
    noTarget: "Inserisci la cifra da raggiungere.",
    already: "Ci sei già: quello che hai copre l'obiettivo.",
    unreachable: (years) => `Così non ci arrivi: senza un versamento mensile (o con un rendimento troppo basso) la cifra resta lontana oltre ${years} anni.`,
    barStart: "Quello che hai",
    barContributed: "Versamenti",
    barGrowth: "Rendimento",
    reachedIn: "Ci arrivi in",
    around: "Cioè verso",
    inMonths: (months) => `tra ${months} mesi`,
    contributed: "Versato in tutto",
    growth: "Dal rendimento",
    byDate: "E per arrivarci entro una data?",
    within: "Entro quanti anni",
    noHorizon: "Inserisci la cifra da raggiungere e un numero di anni.",
    needed: "Servono al mese",
    overMonths: (months) => `Per ${months} mesi`,
    paidInSuffix: " versati",
    dateLocale: "it-IT",
    duration: yearsAndMonths,
    parse: num,
    amount: eur0,
  },
  en: {
    goal: "The goal",
    target: "Amount to reach (€)",
    start: "What you already have (€)",
    monthly: "What you put aside each month (€)",
    rate: "Annual return (%, 0 if it stays in the account)",
    when: "When you get there",
    noTarget: "Enter the amount to reach.",
    already: "You're already there: what you have covers the goal.",
    unreachable: (years) => `At this pace you won't get there: without a monthly deposit (or with too low a return) the amount stays out of reach for more than ${years} years.`,
    barStart: "What you have",
    barContributed: "Deposits",
    barGrowth: "Return",
    reachedIn: "You get there in",
    around: "That's around",
    inMonths: (months) => `in ${months} months`,
    contributed: "Deposited in total",
    growth: "From the return",
    byDate: "What if you want to get there by a date?",
    within: "Within how many years",
    noHorizon: "Enter the amount to reach and a number of years.",
    needed: "Needed each month",
    overMonths: (months) => `Over ${months} months`,
    paidInSuffix: " deposited",
    dateLocale: "en-US",
    duration: yearsAndMonthsEn,
    parse: numEn,
    amount: (n) => money(n, "en"),
  },
};

export interface ObiettivoCalculatorProps {
  /** Language of the labels, the amounts and the arrival month. */
  locale?: Locale;
}

/** Savings goal calculator: how long it takes to reach an amount, and how much a month it takes to get there by a date. */
export function ObiettivoCalculator({ locale = "it" }: ObiettivoCalculatorProps) {
  const t = TEXT[locale];
  const parse = t.parse;
  const fmt = t.amount;
  const [target, setTarget] = useState("20000");
  const [start, setStart] = useState("2000");
  const [monthly, setMonthly] = useState("300");
  const [rate, setRate] = useState("0");
  const [years, setYears] = useState("3");
  const today = useToday();

  const input = { target: Math.max(0, parse(target)), start: Math.max(0, parse(start)), monthly: Math.max(0, parse(monthly)), annualRatePct: Math.max(0, parse(rate)) };
  const valid = input.target > 0;
  const plan = valid ? planTarget(input) : null;
  const reached = plan !== null && Number.isFinite(plan.months);
  const horizonMonths = Math.round(Math.min(MAX_YEARS, Math.max(0, parse(years))) * 12);
  const needed = valid && horizonMonths > 0 ? monthlyForTarget(input, horizonMonths) : null;

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>{t.goal}</h2>
          <div className="field"><label htmlFor="o-t">{t.target}</label><input id="o-t" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-s">{t.start}</label><input id="o-s" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-m">{t.monthly}</label><input id="o-m" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-r">{t.rate}</label><input id="o-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>{t.when}</h2>
          {!plan ? (
            <p>{t.noTarget}</p>
          ) : plan.months === 0 ? (
            <p>{t.already}</p>
          ) : !reached ? (
            <p>{t.unreachable(MAX_YEARS)}</p>
          ) : (
            <div className="res">
              <SplitBar parts={[{ label: t.barStart, value: input.start, tone: "mut" }, { label: t.barContributed, value: plan.contributed, tone: "acc" }, { label: t.barGrowth, value: plan.growth, tone: "pos" }]} />
              <div className="row key"><span>{t.reachedIn}</span><b>{t.duration(plan.months)}</b></div>
              <div className="row"><span>{t.around}</span><b>{today ? arrivalLabel(today, plan.months, t.dateLocale) : t.inMonths(plan.months)}</b></div>
              <div className="row"><span>{t.contributed}</span><b>{fmt(plan.contributed)}</b></div>
              <div className="row"><span>{t.growth}</span><b>{fmt(plan.growth)}</b></div>
            </div>
          )}
        </div>
      </div>
      <h2>{t.byDate}</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="o-y">{t.within}</label><input id="o-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {needed === null ? (
            <p>{t.noHorizon}</p>
          ) : (
            <div className="res">
              <div className="row key"><span>{t.needed}</span><b>{fmt(needed)}</b></div>
              <div className="row"><span>{t.overMonths(horizonMonths)}</span><b>{fmt(needed * horizonMonths)}{t.paidInSuffix}</b></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
