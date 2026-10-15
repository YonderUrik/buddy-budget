"use client";

import { useState, useSyncExternalStore } from "react";
import { SplitBar } from "@/components/viz/viz";
import { groupThousands } from "@/lib/format";
import { monthlyForTarget, planTarget } from "@/lib/tools/obiettivo";

/** Orizzonte massimo (anni) per «entro quando». */
const MAX_YEARS = 100;

const eur0 = (n: number) => `${groupThousands(n)} €`;
const num = (s: string) => (Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : 0);

/** «4 anni e 2 mesi», «11 mesi», «1 anno». */
function yearsAndMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y > 0 ? `${y} ${y === 1 ? "anno" : "anni"}` : "", m > 0 ? `${m} ${m === 1 ? "mese" : "mesi"}` : ""].filter(Boolean);
  return parts.join(" e ") || "0 mesi";
}

/** La data di oggi, letta solo nel browser: la pagina è statica e il mese di arrivo non deve essere quello della build. */
let todayInBrowser: Date | null = null;
const subscribeNothing = () => () => {};
function useToday(): Date | null {
  return useSyncExternalStore(subscribeNothing, () => (todayInBrowser ??= new Date()), () => null);
}

/** Mese e anno di arrivo, a partire da oggi («giugno 2031»). */
function arrivalLabel(from: Date, months: number): string {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

/** Calcolatore dell'obiettivo di risparmio: in quanto tempo si arriva a una cifra, e quanto serve al mese per arrivarci entro una data. */
export function ObiettivoCalculator() {
  const [target, setTarget] = useState("20000");
  const [start, setStart] = useState("2000");
  const [monthly, setMonthly] = useState("300");
  const [rate, setRate] = useState("0");
  const [years, setYears] = useState("3");
  const today = useToday();

  const input = { target: Math.max(0, num(target)), start: Math.max(0, num(start)), monthly: Math.max(0, num(monthly)), annualRatePct: Math.max(0, num(rate)) };
  const valid = input.target > 0;
  const plan = valid ? planTarget(input) : null;
  const reached = plan !== null && Number.isFinite(plan.months);
  const horizonMonths = Math.round(Math.min(MAX_YEARS, Math.max(0, num(years))) * 12);
  const needed = valid && horizonMonths > 0 ? monthlyForTarget(input, horizonMonths) : null;

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>L&apos;obiettivo</h2>
          <div className="field"><label htmlFor="o-t">Cifra da raggiungere (€)</label><input id="o-t" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-s">Quanto hai già (€)</label><input id="o-s" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-m">Quanto metti da parte ogni mese (€)</label><input id="o-m" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-r">Rendimento annuo (%, 0 se resta sul conto)</label><input id="o-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>Quando ci arrivi</h2>
          {!plan ? (
            <p>Inserisci la cifra da raggiungere.</p>
          ) : plan.months === 0 ? (
            <p>Ci sei già: quello che hai copre l&apos;obiettivo.</p>
          ) : !reached ? (
            <p>Così non ci arrivi: senza un versamento mensile (o con un rendimento troppo basso) la cifra resta lontana oltre {MAX_YEARS} anni.</p>
          ) : (
            <div className="res">
              <SplitBar parts={[{ label: "Quello che hai", value: input.start, tone: "mut" }, { label: "Versamenti", value: plan.contributed, tone: "acc" }, { label: "Rendimento", value: plan.growth, tone: "pos" }]} />
              <div className="row key"><span>Ci arrivi in</span><b>{yearsAndMonths(plan.months)}</b></div>
              <div className="row"><span>Cioè verso</span><b>{today ? arrivalLabel(today, plan.months) : `tra ${plan.months} mesi`}</b></div>
              <div className="row"><span>Versato in tutto</span><b>{eur0(plan.contributed)}</b></div>
              <div className="row"><span>Dal rendimento</span><b>{eur0(plan.growth)}</b></div>
            </div>
          )}
        </div>
      </div>
      <h2>E per arrivarci entro una data?</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="o-y">Entro quanti anni</label><input id="o-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {needed === null ? (
            <p>Inserisci la cifra da raggiungere e un numero di anni.</p>
          ) : (
            <div className="res">
              <div className="row key"><span>Servono al mese</span><b>{eur0(needed)}</b></div>
              <div className="row"><span>Per {horizonMonths} mesi</span><b>{eur0(needed * horizonMonths)} versati</b></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
