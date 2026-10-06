import type { CostImpact } from "@/lib/investments/cost-impact";
import { formatCurrency } from "@/lib/format";

export interface CostImpactSummaryProps { impact: CostImpact; currency: string }
const percentage = (value: number) => new Intl.NumberFormat("it-IT", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const points = (value: number) => `${new Intl.NumberFormat("it-IT", { signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value * 100)} punti percentuali`;

/** Costs and paid taxes recorded on transactions, with an explicit counterfactual return comparison. */
export function CostImpactSummary({ impact, currency }: CostImpactSummaryProps) {
  const money = (value: number) => formatCurrency(value, currency);
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
        Costi e imposte sulle operazioni · {money(impact.period.total)} nel periodo
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <p className="text-xs text-muted-foreground">Periodo del grafico: {impact.from ?? "—"} – {impact.to}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">Commissioni e imposte registrate</caption>
            <thead><tr><th className="py-2 font-medium">Voce</th><th className="text-right font-medium">Nel periodo</th><th className="text-right font-medium">Dall’inizio</th></tr></thead>
            <tbody>
              <tr><th className="py-2 font-normal">Costi e commissioni</th><td className="text-right">{money(impact.period.fees)}</td><td className="text-right">{money(impact.lifetime.fees)}</td></tr>
              <tr><th className="py-2 font-normal">Imposte pagate e ritenute</th><td className="text-right">{money(impact.period.taxes)}</td><td className="text-right">{money(impact.lifetime.taxes)}</td></tr>
              <tr className="border-t font-medium"><th className="py-2">Totale</th><td className="text-right">{money(impact.period.total)}</td><td className="text-right">{money(impact.lifetime.total)}</td></tr>
            </tbody>
          </table>
        </div>
        {impact.grossReturn !== null && impact.netReturn !== null && impact.totalImpact !== null ? (
          <div className="space-y-1">
            <p>Rendimento dei titoli nel periodo (TWR): <strong>{percentage(impact.netReturn)}</strong>.</p>
            <p>Senza i costi e le imposte registrati nel periodo: <strong>{percentage(impact.grossReturn)}</strong>.</p>
            <p>Impatto complessivo: <strong>{points(impact.totalImpact)}</strong>.</p>
            <p className="text-muted-foreground">Costi: {points(impact.feeImpact!)} · Imposte: {points(impact.taxImpact!)}.</p>
          </div>
        ) : <p className="text-muted-foreground">Impatto sul rendimento non disponibile: dati di valorizzazione insufficienti.</p>}
        <p className="text-xs text-muted-foreground">Importi registrati su acquisti, vendite, dividendi e cedole, al netto degli eventuali rimborsi. Sono già detratti dai rendimenti: non vengono sottratti una seconda volta. Esclusi oneri separati del conto broker, costi interni dei fondi e imposte stimate o non registrate.</p>
        <p className="text-xs text-muted-foreground">Confronto stimato a parità di operazioni e prezzi, senza reinvestire i costi risparmiati. L’effetto dei costi è calcolato prima delle imposte; la somma dei due effetti coincide con l’impatto complessivo. Il cash è escluso.</p>
      </div>
    </details>
  );
}
