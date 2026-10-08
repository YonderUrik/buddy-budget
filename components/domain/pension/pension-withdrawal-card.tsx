/**
 * "Se prelevassi oggi": per ogni ipotesi una barra con il netto stimato come forbice e la fetta di tasse. La forbice
 * (non una cifra sola) perché la base su cui si paga l'imposta in uscita va confermata da un professionista.
 */

import { WalletIcon } from "lucide-react";
import type { WithdrawalReason, WithdrawalScenario } from "@/lib/calc/pension";
import { formatPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";

export interface PensionWithdrawalCardProps {
  scenarios: WithdrawalScenario[];
  /** Controvalore di partenza: la barra intera. */
  value: number;
  currency: string;
  /** Stime con gli anni reali: se passate e diverse da `scenarios` si mostra la differenza e l'etichetta "simulazione". */
  baseline?: WithdrawalScenario[];
  isSimulated?: boolean;
}

const REASON_LABELS: Record<WithdrawalReason, { title: string; detail: string }> = {
  pensionamento: { title: "Alla pensione", detail: "Fino al 50-60% in capitale, il resto in rendita" },
  sanitarie: { title: "Spese sanitarie straordinarie", detail: "Anticipazione per terapie e interventi" },
  altri: { title: "Altri motivi", detail: "Riscatto fuori dai casi previsti dalla legge" },
};

const RANGE_HINT =
  "Il valore alto presuppone che l'imposta si applichi solo ai contributi (i rendimenti hanno già pagato il 20% mentre maturavano). Il valore basso applica l'aliquota a tutto il controvalore. Quale sia giusto per te va confermato da un commercialista; non sono incluse eventuali penali del prodotto.";

export function PensionWithdrawalCard({ scenarios, value, currency, baseline, isSimulated = false }: PensionWithdrawalCardProps) {
  const total = Math.max(value, 1);
  return (
    <PensionSection
      icon={WalletIcon}
      title="Se prelevassi oggi"
      color="var(--swatch-orange)"
      hint={{ label: "Come si stima il netto", text: RANGE_HINT }}
      description={
        <>
          {isSimulated ? <strong className="font-medium text-foreground">Simulazione dell&apos;aliquota in corso (vedi «Quando l&apos;aliquota scende»). </strong> : null}
          Quanto ti resterebbe al netto delle tasse, in tre ipotesi. È una stima, non consulenza fiscale.
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {scenarios.map((scenario) => {
          const label = REASON_LABELS[scenario.reason];
          const lowShare = (scenario.netLow / total) * 100;
          const delta = isSimulated ? scenario.netLow - (baseline?.find((b) => b.reason === scenario.reason)?.netLow ?? scenario.netLow) : 0;
          const highShare = (scenario.netHigh / total) * 100;
          return (
            <div key={scenario.reason} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <p className="font-semibold text-foreground">{label.title}</p>
                <p className="font-heading text-xl font-medium tabular-nums text-foreground">
                  {money(scenario.netLow, currency)} <span className="text-text-2">–</span> {money(scenario.netHigh, currency)}
                </p>
              </div>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-neg/25" role="img" aria-label={`Netto tra ${money(scenario.netLow, currency)} e ${money(scenario.netHigh, currency)} su ${money(value, currency)}`}>
                <span className="h-full bg-primary" style={{ width: `${lowShare}%` }} />
                <span className="h-full bg-primary/45" style={{ width: `${Math.max(0, highShare - lowShare)}%` }} />
              </div>
              <p className="text-sm text-text-2">
                {label.detail} · aliquota {formatPercent(scenario.rate)}
                {delta !== 0 ? (
                  <span className={delta > 0 ? "text-pos" : "text-neg"}>
                    {" "}
                    · {delta > 0 ? "+" : "−"}
                    {money(Math.abs(delta), currency)} rispetto a oggi
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-2">
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Netto sicuro</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/45" aria-hidden="true" />Netto possibile</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neg/40" aria-hidden="true" />Tasse</li>
        </ul>
      </div>
    </PensionSection>
  );
}
