"use client";

import { useRef, useState } from "react";
import { SplitBar } from "@/components/viz/viz";
import { track, type LandingEvents } from "@/lib/analytics";
import { eur } from "@/lib/format";
import { monthlyNeeded, savingsGoal } from "@/lib/tools/risparmio";

type Field = LandingEvents["savings_goal_used"]["field"];

const num = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** «2 anni e 3 mesi», «8 mesi», «subito». */
export function formatDuration(months: number): string {
  if (months <= 0) return "subito";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const years = y === 0 ? "" : y === 1 ? "1 anno" : `${y} anni`;
  const rest = m === 0 ? "" : m === 1 ? "1 mese" : `${m} mesi`;
  return [years, rest].filter(Boolean).join(" e ");
}

/**
 * Calcolatore dell'obiettivo di risparmio: quanto ci metti a mettere da parte una cifra con il risparmio di oggi,
 * e cosa cambia mettendo da parte qualcosa in più ogni mese. È il calcolo che in app fa Analitiche con i dati veri.
 */
export function RisparmioCalculator() {
  const [target, setTarget] = useState("20000");
  const [start, setStart] = useState("3000");
  const [monthly, setMonthly] = useState("300");
  const [rate, setRate] = useState("0");
  const [extra, setExtra] = useState("100");
  const [years, setYears] = useState("3");
  const used = useRef(false);

  const change = (field: Field, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    if (!used.current) {
      used.current = true;
      track("savings_goal_used", { field });
    }
  };

  const base = { target: num(target), start: num(start), annualReturnPct: Math.max(0, num(rate)) };
  const now = savingsGoal({ ...base, monthly: Math.max(0, num(monthly)) });
  const more = savingsGoal({ ...base, monthly: Math.max(0, num(monthly) + num(extra)) });
  const saved = now.months !== null && more.months !== null ? now.months - more.months : null;
  const deadline = Math.max(1, Math.round(num(years) * 12));
  const need = monthlyNeeded(base.target, base.start, deadline, base.annualReturnPct);

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>I tuoi numeri</h2>
          <div className="field"><label htmlFor="r-t">Quanto vuoi mettere da parte (€)</label><input id="r-t" inputMode="decimal" value={target} onChange={change("obiettivo", setTarget)} /></div>
          <div className="field"><label htmlFor="r-s">Quanto hai già da parte (€)</label><input id="r-s" inputMode="decimal" value={start} onChange={change("partenza", setStart)} /></div>
          <div className="field"><label htmlFor="r-m">Quanto riesci a risparmiare al mese (€)</label><input id="r-m" inputMode="decimal" value={monthly} onChange={change("mensile", setMonthly)} /></div>
          <div className="field"><label htmlFor="r-r">Rendimento all&apos;anno (%, 0 se restano sul conto)</label><input id="r-r" inputMode="decimal" value={rate} onChange={change("rendimento", setRate)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>Ai ritmi di oggi</h2>
          {now.months === null ? (
            <p>Con questi numeri non ci arrivi: prova ad aumentare il risparmio mensile.</p>
          ) : (
            <div className="res">
              <div className="row key dur"><span>Ci arrivi in</span><b>{formatDuration(now.months)}</b></div>
              {now.months > 0 ? (
                <>
                  {now.growth > 0 ? <SplitBar parts={[{ label: "Messi da parte da te", value: now.contributed, tone: "acc" }, { label: "Dal rendimento", value: Math.max(0, now.growth), tone: "pos" }]} /> : null}
                  <div className="row"><span>Messi da parte da te</span><b>{eur(now.contributed)}</b></div>
                  <div className="row"><span>Dal rendimento</span><b>{eur(Math.max(0, now.growth))}</b></div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <h2>E se risparmiassi di più ogni mese?</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="r-x">Risparmio in più al mese (€)</label><input id="r-x" inputMode="decimal" value={extra} onChange={change("extra", setExtra)} /></div>
          <div className="field"><label htmlFor="r-y">Oppure: entro quanti anni vuoi arrivarci</label><input id="r-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <div className="res">
            <div className="row"><span>Mettendo da parte {eur(Math.max(0, num(monthly) + num(extra)))} al mese</span><b>{more.months === null ? "non ci arrivi" : formatDuration(more.months)}</b></div>
            {saved !== null && saved > 0 ? <div className="row key dur"><span>Arrivi prima di</span><b>{formatDuration(saved)}</b></div> : null}
            <div className="row key dur"><span>Per arrivarci in {formatDuration(deadline)} servono</span><b>{eur(Math.ceil(need))} al mese</b></div>
          </div>
        </div>
      </div>
    </>
  );
}
