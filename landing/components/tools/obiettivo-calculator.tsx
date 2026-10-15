"use client";
import { t as trLanding, LOCALE } from "@/lib/localization";

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
  const parts = [y > 0 ? `${y} ${trLanding(y === 1 ? "anno" : "anni")}` : "", m > 0 ? `${m} ${trLanding(m === 1 ? "mese" : "mesi")}` : ""].filter(Boolean);
  return parts.join(trLanding(" e ")) || trLanding("0 mesi");
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
  return d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
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
          <h2>{trLanding("L'obiettivo")}</h2>
          <div className="field"><label htmlFor="o-t">{trLanding("Cifra da raggiungere (€)")}</label><input id="o-t" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-s">{trLanding("Quanto hai già (€)")}</label><input id="o-s" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-m">{trLanding("Quanto metti da parte ogni mese (€)")}</label><input id="o-m" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
          <div className="field"><label htmlFor="o-r">{trLanding("Rendimento annuo (%, 0 se resta sul conto)")}</label><input id="o-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>{trLanding("Quando ci arrivi")}</h2>
          {!plan ? (
            <p>{trLanding("Inserisci la cifra da raggiungere.")}</p>
          ) : plan.months === 0 ? (
            <p>{trLanding("Ci sei già: quello che hai copre l'obiettivo.")}</p>
          ) : !reached ? (
            <p>{trLanding("Così non ci arrivi: senza un versamento mensile (o con un rendimento troppo basso) la cifra resta lontana oltre ")}{trLanding(MAX_YEARS)}{trLanding(" anni.")}</p>
          ) : (
            <div className="res">
              <SplitBar parts={[{ label: "Quello che hai", value: input.start, tone: "mut" }, { label: "Versamenti", value: plan.contributed, tone: "acc" }, { label: "Rendimento", value: plan.growth, tone: "pos" }]} />
              <div className="row key"><span>{trLanding("Ci arrivi in")}</span><b>{trLanding(yearsAndMonths(plan.months))}</b></div>
              <div className="row"><span>{trLanding("Cioè verso")}</span><b>{trLanding(today ? arrivalLabel(today, plan.months) : `${trLanding("tra")} ${plan.months} ${trLanding("mesi")}`)}</b></div>
              <div className="row"><span>{trLanding("Versato in tutto")}</span><b>{trLanding(eur0(plan.contributed))}</b></div>
              <div className="row"><span>{trLanding("Dal rendimento")}</span><b>{trLanding(eur0(plan.growth))}</b></div>
            </div>
          )}
        </div>
      </div>
      <h2>{trLanding("E per arrivarci entro una data?")}</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="o-y">{trLanding("Entro quanti anni")}</label><input id="o-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {needed === null ? (
            <p>{trLanding("Inserisci la cifra da raggiungere e un numero di anni.")}</p>
          ) : (
            <div className="res">
              <div className="row key"><span>{trLanding("Servono al mese")}</span><b>{trLanding(eur0(needed))}</b></div>
              <div className="row"><span>{trLanding("Per ")}{trLanding(horizonMonths)}{trLanding(" mesi")}</span><b>{trLanding(eur0(needed * horizonMonths))}{trLanding(" versati")}</b></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
