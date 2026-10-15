"use client";
import { t as trLanding, LOCALE } from "@/lib/localization";

import { useState } from "react";
import { SplitBar } from "@/components/viz/viz";
import { buildFrenchPlan, simulateEarlyRepayment } from "@/lib/tools/ammortamento";

const MAX_MONTHS = 600;
const eur2 = (n: number) => new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }).format(n);
const num = (s: string) => (Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : 0);

/** Calcolatore del piano di ammortamento alla francese, con simulazione di estinzione parziale. */
export function AmmortamentoCalculator() {
  const [principal, setPrincipal] = useState("100000");
  const [rate, setRate] = useState("3");
  const [years, setYears] = useState("20");
  const [after, setAfter] = useState("5");
  const [extra, setExtra] = useState("20000");
  const [penalty, setPenalty] = useState("0");
  const months = Math.min(MAX_MONTHS, Math.max(1, Math.round(num(years) * 12)));
  const P = Math.max(0, num(principal));
  const valid = P > 0 && num(rate) >= 0;
  const plan = valid ? buildFrenchPlan(P, num(rate), months) : null;
  const afterMonths = Math.min(months - 1, Math.max(1, Math.round(num(after) * 12)));
  const early = valid && months > 1 ? simulateEarlyRepayment({ principal: P, annualRatePct: num(rate), months, afterMonths, extra: Math.max(0, num(extra)), penaltyPct: Math.max(0, num(penalty)) }) : null;

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>{trLanding("Il finanziamento")}</h2>
          <div className="field"><label htmlFor="a-p">{trLanding("Importo (€)")}</label><input id="a-p" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-r">{trLanding("Tasso nominale annuo, TAN (%)")}</label><input id="a-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-y">{trLanding("Durata (anni)")}</label><input id="a-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>{trLanding("Il piano")}</h2>
          {plan ? (
            <div className="res">
              <SplitBar parts={[{ label: "Capitale", value: P, tone: "pos" }, { label: "Interessi", value: plan.totalInterest, tone: "neg" }]} />
              <div className="row key"><span>{trLanding("Rata mensile")}</span><b>{trLanding(eur2(plan.installment))}</b></div>
              <div className="row"><span>{trLanding("Interessi totali")}</span><b>{trLanding(eur2(plan.totalInterest))}</b></div>
              <div className="row"><span>{trLanding("Totale pagato")}</span><b>{trLanding(eur2(plan.totalPaid))}</b></div>
              <div className="row"><span>{trLanding("Numero di rate")}</span><b>{trLanding(months)}</b></div>
            </div>
          ) : (
            <p>{trLanding("Inserisci un importo e un tasso validi.")}</p>
          )}
        </div>
      </div>
      <h2>{trLanding("E se estinguo una parte in anticipo?")}</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="e-a">{trLanding("Dopo quanti anni (dall'inizio)")}</label><input id="e-a" inputMode="decimal" value={after} onChange={(e) => setAfter(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-x">{trLanding("Capitale estinto (€)")}</label><input id="e-x" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-p">{trLanding("Penale sul capitale estinto (%, di solito 0 per i mutui sull'abitazione)")}</label><input id="e-p" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {early ? (
            <div className="res">
              <div className="row"><span>{trLanding("Interessi risparmiati")}</span><b>{trLanding(eur2(early.interestSaved))}</b></div>
              <div className="row"><span>{trLanding("Penale")}</span><b>{trLanding(early.penalty > 0 ? "−" : "")}{trLanding(eur2(early.penalty))}</b></div>
              <div className="row key"><span>{trLanding("Risparmio netto")}</span><b>{trLanding(eur2(early.netSaving))}</b></div>
              <div className="row"><span>{trLanding("Stessa rata: rate che restano")}</span><b>{trLanding(early.monthsLeftSameInstallment)}</b></div>
              <div className="row"><span>{trLanding("Stessa durata: nuova rata")}</span><b>{trLanding(eur2(early.newInstallmentSameTerm))}</b></div>
            </div>
          ) : null}
        </div>
      </div>
      {plan ? (
        <div className="sched" tabIndex={0} role="region" aria-label={trLanding("Piano di ammortamento completo")}>
          <table>
            <thead><tr><th>{trLanding("Rata")}</th><th>{trLanding("Quota capitale")}</th><th>{trLanding("Quota interessi")}</th><th>{trLanding("Debito residuo")}</th></tr></thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.n}><td>{trLanding(row.n)}</td><td>{trLanding(eur2(row.principal))}</td><td>{trLanding(eur2(row.interest))}</td><td>{trLanding(eur2(row.balance))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
