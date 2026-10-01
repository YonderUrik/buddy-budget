/**
 * "Se prelevassi oggi": netto stimato in tre ipotesi, come forbice (non una cifra sola) perché la base su cui si paga
 * l'imposta in uscita va confermata da un professionista. Mostra anche quando l'aliquota scende.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/domain/shared";
import { exitTaxMilestones, type WithdrawalReason, type WithdrawalScenario } from "@/lib/calc/pension";
import { formatLongDateKey, formatPercent, money } from "./pension-format";

export interface PensionWithdrawalCardProps {
  scenarios: WithdrawalScenario[];
  /** Data di prima adesione: serve a dire quando l'aliquota scende. */
  adhesionDate: string | null;
  currency: string;
}

const REASON_LABELS: Record<WithdrawalReason, { title: string; detail: string }> = {
  pensionamento: { title: "Alla pensione", detail: "Fino al 50-60% in capitale, il resto in rendita" },
  sanitarie: { title: "Spese sanitarie straordinarie", detail: "Anticipazione per terapie e interventi" },
  altri: { title: "Altri motivi", detail: "Riscatto fuori dai casi previsti dalla legge" },
};

const RANGE_HINT =
  "Il valore alto presuppone che l'imposta si applichi solo ai contributi (i rendimenti hanno già pagato il 20% mentre maturavano). Il valore basso applica l'aliquota a tutto il controvalore. Quale sia giusto per te va confermato da un commercialista; non sono incluse eventuali penali del prodotto.";

export function PensionWithdrawalCard({ scenarios, adhesionDate, currency }: PensionWithdrawalCardProps) {
  const milestones = adhesionDate ? exitTaxMilestones(adhesionDate) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Se prelevassi oggi <InfoHint label="Come si stima il netto">{RANGE_HINT}</InfoHint>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Quanto ti resterebbe al netto delle tasse, in tre ipotesi. È una stima, non consulenza fiscale.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-border">
          {scenarios.map((scenario) => {
            const label = REASON_LABELS[scenario.reason];
            return (
              <li key={scenario.reason} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label.title}</p>
                  <p className="text-xs text-muted-foreground">{label.detail} · aliquota {formatPercent(scenario.rate)}</p>
                </div>
                <p className="font-heading text-lg font-medium tabular-nums text-foreground">
                  {money(scenario.netLow, currency)} <span className="text-muted-foreground">–</span> {money(scenario.netHigh, currency)}
                </p>
              </li>
            );
          })}
        </ul>
        {milestones ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            L&apos;aliquota del 15% comincia a scendere dal <strong className="font-medium text-foreground">{formatLongDateKey(milestones.reductionStartsOn)}</strong> (15 anni dalla prima adesione) e arriva al 9% dal{" "}
            <strong className="font-medium text-foreground">{formatLongDateKey(milestones.minRateOn)}</strong>.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
