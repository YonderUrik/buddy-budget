"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Card "Quanto rischia" (Investimenti › Performance): in alto un livello di rischio (da basso a molto alto) con una frase,
 * poi i numeri in parole semplici (oscillazione, perdita peggiore, rischio ripagato e, con un indice di confronto, quanto
 * lo segue), ognuno con la frase che lo spiega e il nome tecnico nel popover "i". Grafico e note stanno in dettagli a
 * scomparsa. Stesso periodo della card dei rendimenti.
 */

import { ShieldAlertIcon } from "lucide-react";
import { PanelSection } from "../panel-section";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import type { MaxDrawdown, PortfolioRisk } from "@/lib/calc/risk";
import { daysBetween } from "@/lib/calc/returns";

import { localizedRiskInsights, type SharpeLevel } from "@/lib/investments/risk-insights";

import { DrawdownChart } from "./drawdown-chart";
import { RiskDetails } from "./risk-details";
import { RiskLevelMeter } from "./risk-level-meter";
import { RiskMetric } from "./risk-metric";
import { RiskMethod } from "./risk-method";

const PERIOD_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "Nell'ultimo mese",
  "3mesi": "Negli ultimi 3 mesi",
  "1anno": "Nell'ultimo anno",
  max: "Dalla prima operazione",
};

const SHARPE_WORDS: Record<SharpeLevel, string> = { negativo: "No", basso: "Poco", discreto: "Discreto", buono: "Bene" };

export interface RiskCardProps {
  risk: PortfolioRisk;
  period: NetWorthPeriod;
  periodLabel?: string;
  /** Nome dell'indice di confronto scelto nella card dei rendimenti, o null. */
  benchmarkName: string | null;
  currency: string;
}

export function RiskCard({ risk, period, benchmarkName, currency, periodLabel }: RiskCardProps) {
  const { betaInsight, riskLevel, sharpeInsight, sharpeLevel, volatilityInsight } = localizedRiskInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatPct: pct, formatRatio } = localizedFormats(formattingLocale);


  const { formatDateWithYear } = localizedFormats(formattingLocale);
  function drawdownText(drawdown: MaxDrawdown): string {
  if (drawdown.depth === 0) return tr("Nel periodo non è mai sceso sotto il massimo precedente.");
  const span = tr("Dal {0} al {1}", { 0: formatDateWithYear(drawdown.peakDate), 1: formatDateWithYear(drawdown.troughDate) });
  if (drawdown.recoveryDate) return tr("{0}; tornato al massimo in {1} giorni.", { 0: span, 1: daysBetween(drawdown.troughDate, drawdown.recoveryDate) });
  return tr("{0}; non è ancora tornato al massimo (a fine periodo {1}).", { 0: span, 1: formatSignedPct(drawdown.current) });
}

  const { t: tr } = useLocalization();
  if (risk.volatility === null) {
    return (
      <PanelSection icon={ShieldAlertIcon} title={tr("Quanto rischia")} color="var(--swatch-orange)" description={periodLabel ?? tr(PERIOD_LABELS[period])}>
        <p className="text-sm text-muted-foreground">{tr("Servono almeno 20 giorni di borsa nel periodo per misurare il rischio. Prova un periodo più lungo o torna tra qualche giorno.")}</p>
      </PanelSection>
    );
  }

  const bench = risk.benchmark;
  const footnote = [
    risk.fewData ? tr("Meno di un anno di dati: numeri indicativi.") : null,
    benchmarkName ? null : tr("Scegli un indice in «Rendimenti del periodo» per vedere quanto lo segui."),
  ]
    .filter(Boolean)
    .join(" ");
    return (
    <PanelSection icon={ShieldAlertIcon} title={tr("Quanto rischia")} color="var(--swatch-orange)" description={periodLabel ?? tr(PERIOD_LABELS[period])}>
      <div className="flex flex-col gap-5">
        <RiskLevelMeter
          level={riskLevel(risk.volatility)}
          volatility={risk.volatility}
          volatilityText={`±${pct(risk.volatility)}`}
          volatilityNote={volatilityInsight(risk.volatility, bench?.volatility ?? null, benchmarkName)}
          volatilityHint="Nome tecnico: volatilità. Di quanto si muove di solito il valore in un anno, in più o in meno. Più è alta, più il percorso è accidentato."
        />

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-t pt-5 sm:grid-cols-2">
          <RiskMetric
            label={tr("Perdita peggiore")}
            value={risk.drawdown && risk.drawdown.depth < 0 ? formatSignedPct(risk.drawdown.depth) : "0%"}
            note={tr("dal massimo")}
            description={risk.drawdown ? drawdownText(risk.drawdown) : null}
            hint={tr("Nome tecnico: massima perdita dal picco (drawdown). Quanto hai visto scendere il portafoglio, al massimo, rispetto al suo valore più alto. Non conta i versamenti.")}
          />
          <RiskMetric
            label={tr("Rischio ripagato?")}
            value={risk.sharpe === null ? null : tr(SHARPE_WORDS[sharpeLevel(risk.sharpe)])}
            note={risk.sharpe === null ? tr("servono 3 mesi di dati") : tr("Sharpe {0}", {0: formatRatio(risk.sharpe, 2)})}
            description={risk.sharpe === null ? null : sharpeInsight(risk.sharpe)}
            hint={tr("Nome tecnico: Sharpe ratio. Quanto rendimento in più di un conto deposito hai avuto per ogni unità di rischio. Sotto 0,5 è poco, sopra 1 è buono.")}
          />
          {benchmarkName ? (
            <RiskMetric
              label={tr("Quanto segue l'indice")}
              value={bench?.beta === null || bench?.beta === undefined ? null : formatRatio(bench.beta, 2)}
              note={bench?.correlation != null ? tr("correlazione {0}", {0: formatRatio(bench.correlation, 2)}) : tr("servono 3 mesi di dati")}
              description={bench?.beta != null ? betaInsight(bench.beta, benchmarkName) : null}
              hint={tr("Nome tecnico: beta rispetto a {0}. 1 vuol dire che si muove come l'indice, 0,5 la metà, 1,5 una volta e mezza. La correlazione (da −1 a 1) dice quanto i movimenti vanno nella stessa direzione.", {0: benchmarkName})}
            />
          ) : null}
        </div>

        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}

        <div className="flex flex-col">
          {risk.drawdownSeries.length >= 2 ? (
            <RiskDetails title={tr("Guarda le cadute nel tempo")}>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{tr("Quanto il portafoglio era sotto il suo massimo, giorno per giorno.")}</p>
                <DrawdownChart series={risk.drawdownSeries} />
              </div>
            </RiskDetails>
          ) : null}
          <RiskDetails title={tr("Come è calcolato")}>
            <div className="flex flex-col gap-3">
              <RiskMethod />
              {risk.sharpe !== null ? <p className="text-sm text-muted-foreground">{risk.riskFreeRate !== null ? tr("Conto con il tasso €STR medio del periodo ({0}).", {0: pct(risk.riskFreeRate)}) : tr(currency !== "EUR" ? "Calcolato senza tasso privo di rischio (disponibile solo per l'euro)." : "Calcolato senza tasso privo di rischio: il tasso €STR non è ancora stato scaricato.")}</p> : null}
            </div>
          </RiskDetails>
        </div>
      </div>
    </PanelSection>
  );
}
