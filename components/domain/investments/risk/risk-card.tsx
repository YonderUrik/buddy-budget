/**
 * Card "Quanto rischia": volatilità, massima perdita dal picco con grafico "sott'acqua", Sharpe e, se c'è un indice di
 * confronto, beta e correlazione. Stesso periodo della card principale; ogni numero ha una frase che lo spiega.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import type { MaxDrawdown, PortfolioRisk } from "@/lib/calc/risk";
import { daysBetween } from "@/lib/calc/returns";
import { formatDateWithYear } from "@/lib/format";
import { betaInsight, sharpeInsight, volatilityInsight } from "@/lib/investments/risk-insights";
import { formatSignedPct } from "../gain-text";
import { DrawdownChart } from "./drawdown-chart";
import { RiskMetric } from "./risk-metric";

const PERIOD_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "Nell'ultimo mese",
  "3mesi": "Negli ultimi 3 mesi",
  "1anno": "Nell'ultimo anno",
  max: "Dalla prima operazione",
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

function decimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function drawdownText(drawdown: MaxDrawdown): string {
  if (drawdown.depth === 0) return "Nel periodo non è mai sceso sotto il massimo precedente.";
  const fall = `Tra il ${formatDateWithYear(drawdown.peakDate)} e il ${formatDateWithYear(drawdown.troughDate)} è sceso del ${pct(-drawdown.depth)} dal massimo`;
  if (drawdown.recoveryDate) return `${fall}; ci ha messo ${daysBetween(drawdown.troughDate, drawdown.recoveryDate)} giorni a tornarci.`;
  return `${fall} e non ci è ancora tornato: oggi è a ${formatSignedPct(drawdown.current)}.`;
}

function riskFreeNote(risk: PortfolioRisk, currency: string): string {
  if (risk.riskFreeRate !== null) return `Conto con il tasso €STR medio del periodo (${pct(risk.riskFreeRate)}).`;
  if (currency !== "EUR") return `Calcolato senza tasso privo di rischio (disponibile solo per l'euro).`;
  return "Calcolato senza tasso privo di rischio: il tasso €STR non è ancora stato scaricato.";
}

export interface RiskCardProps {
  risk: PortfolioRisk;
  period: NetWorthPeriod;
  /** Nome dell'indice di confronto scelto nella card dei rendimenti, o null. */
  benchmarkName: string | null;
  currency: string;
}

export function RiskCard({ risk, period, benchmarkName, currency }: RiskCardProps) {
  const header = (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quanto rischia</CardTitle>
      <p className="text-sm text-muted-foreground">{PERIOD_LABELS[period]}</p>
    </CardHeader>
  );

  if (risk.volatility === null) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Servono almeno 20 giorni di borsa nel periodo per misurare il rischio. Prova un periodo più lungo o torna tra qualche giorno.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bench = risk.benchmark;
  return (
    <Card>
      {header}
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <RiskMetric
            label="Oscillazione"
            value={`±${pct(risk.volatility)}`}
            note="in un anno"
            hint="La volatilità: di quanto si muove di solito il valore in un anno, in più o in meno. Più è alta, più il percorso è accidentato."
          />
          <RiskMetric
            label="Caduta peggiore"
            value={risk.drawdown && risk.drawdown.depth < 0 ? formatSignedPct(risk.drawdown.depth) : "0%"}
            note="dal massimo"
            hint="La massima perdita dal picco: quanto hai visto scendere il portafoglio, al massimo, rispetto al suo valore più alto. Non conta i versamenti."
          />
          <RiskMetric
            label="Rendimento per rischio"
            value={risk.sharpe === null ? null : decimal(risk.sharpe)}
            note={risk.sharpe === null ? "servono 3 mesi di dati" : "Sharpe"}
            hint="Lo Sharpe ratio: quanto rendimento in più di un conto deposito hai avuto per ogni unità di rischio. Sotto 0,5 è poco, sopra 1 è buono."
          />
          {benchmarkName ? (
            <RiskMetric
              label="Segue l'indice"
              value={bench?.beta === null || bench?.beta === undefined ? null : decimal(bench.beta)}
              note={bench?.correlation != null ? `correlazione ${decimal(bench.correlation)}` : "servono 3 mesi di dati"}
              hint={`Il beta rispetto a ${benchmarkName}: 1 vuol dire che si muove come l'indice, 0,5 la metà, 1,5 una volta e mezza. La correlazione (da −1 a 1) dice quanto i movimenti vanno nella stessa direzione.`}
            />
          ) : null}
        </div>

        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>{volatilityInsight(risk.volatility, bench?.volatility ?? null, benchmarkName)}</li>
          {risk.drawdown ? <li>{drawdownText(risk.drawdown)}</li> : null}
          {risk.sharpe !== null ? (
            <li>
              {sharpeInsight(risk.sharpe)} <span className="text-xs">{riskFreeNote(risk, currency)}</span>
            </li>
          ) : null}
          {benchmarkName && bench?.beta != null ? <li>{betaInsight(bench.beta, benchmarkName)}</li> : null}
          {!benchmarkName ? <li className="text-xs">Scegli un indice di confronto in &ldquo;Quanto sta rendendo&rdquo; per vedere quanto lo segui.</li> : null}
        </ul>

        {risk.drawdownSeries.length >= 2 ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Quanto era sotto il massimo, nel tempo</p>
            <DrawdownChart series={risk.drawdownSeries} />
          </div>
        ) : null}
        {risk.fewData ? (
          <p className="text-xs text-muted-foreground">Meno di un anno di dati: prendi questi numeri come indicativi.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
