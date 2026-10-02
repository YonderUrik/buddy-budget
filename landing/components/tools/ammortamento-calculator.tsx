"use client";

import { useState } from "react";
import { BalanceViz, SplitBar } from "@/components/viz/viz";
import { groupThousands } from "@/lib/format";
import { buildFrenchPlan, simulateEarlyRepayment } from "@/lib/tools/ammortamento";

const MAX_MONTHS = 600;
const eur2 = (n: number) => `${groupThousands(Math.trunc(n))},${Math.abs(Math.round((n - Math.trunc(n)) * 100)).toString().padStart(2, "0")} €`;
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
  const yearly = plan ? [P, ...plan.rows.filter((r) => r.n % 12 === 0 || r.n === months).map((r) => r.balance)] : [];
  const afterMonths = Math.min(months - 1, Math.max(1, Math.round(num(after) * 12)));
  const early = valid && months > 1 ? simulateEarlyRepayment({ principal: P, annualRatePct: num(rate), months, afterMonths, extra: Math.max(0, num(extra)), penaltyPct: Math.max(0, num(penalty)) }) : null;

  return (
    <>
      <div className="tool">
        <div className="tool-card">
          <h2>Il finanziamento</h2>
          <div className="field"><label htmlFor="a-p">Importo (€)</label><input id="a-p" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-r">Tasso nominale annuo, TAN (%)</label><input id="a-r" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="field"><label htmlFor="a-y">Durata (anni)</label><input id="a-y" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          <h2>Il piano</h2>
          {plan ? (
            <div className="res">
              <SplitBar parts={[{ label: "Capitale", value: P, tone: "pos" }, { label: "Interessi", value: plan.totalInterest, tone: "neg" }]} />
              <BalanceViz balances={yearly} />
              <div className="row key"><span>Rata mensile</span><b>{eur2(plan.installment)}</b></div>
              <div className="row"><span>Interessi totali</span><b>{eur2(plan.totalInterest)}</b></div>
              <div className="row"><span>Totale pagato</span><b>{eur2(plan.totalPaid)}</b></div>
              <div className="row"><span>Numero di rate</span><b>{months}</b></div>
            </div>
          ) : (
            <p>Inserisci un importo e un tasso validi.</p>
          )}
        </div>
      </div>
      <h2>E se estinguo una parte in anticipo?</h2>
      <div className="tool">
        <div className="tool-card">
          <div className="field"><label htmlFor="e-a">Dopo quanti anni (dall&apos;inizio)</label><input id="e-a" inputMode="decimal" value={after} onChange={(e) => setAfter(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-x">Capitale estinto (€)</label><input id="e-x" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
          <div className="field"><label htmlFor="e-p">Penale sul capitale estinto (%, di solito 0 per i mutui sull&apos;abitazione)</label><input id="e-p" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} /></div>
        </div>
        <div className="tool-card" aria-live="polite">
          {early ? (
            <div className="res">
              <div className="row"><span>Interessi risparmiati</span><b>{eur2(early.interestSaved)}</b></div>
              <div className="row"><span>Penale</span><b>{early.penalty > 0 ? "−" : ""}{eur2(early.penalty)}</b></div>
              <div className="row key"><span>Risparmio netto</span><b>{eur2(early.netSaving)}</b></div>
              <div className="row"><span>Stessa rata: rate che restano</span><b>{early.monthsLeftSameInstallment}</b></div>
              <div className="row"><span>Stessa durata: nuova rata</span><b>{eur2(early.newInstallmentSameTerm)}</b></div>
            </div>
          ) : null}
        </div>
      </div>
      {plan ? (
        <div className="sched" tabIndex={0} role="region" aria-label="Piano di ammortamento completo">
          <table>
            <thead><tr><th>Rata</th><th>Quota capitale</th><th>Quota interessi</th><th>Debito residuo</th></tr></thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.n}><td>{row.n}</td><td>{eur2(row.principal)}</td><td>{eur2(row.interest)}</td><td>{eur2(row.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
