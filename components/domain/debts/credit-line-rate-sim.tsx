/** "Se l'indice sale": quanto costerebbero gli interessi di una linea di credito, con l'utilizzato di oggi, se il tasso salisse. */

import { creditLineRateScenarios } from "@/lib/calc/debt-simulator";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";

export interface CreditLineRateSimProps {
  line: CreditLineView;
  currency: string;
}

export function CreditLineRateSim({ line, currency }: CreditLineRateSimProps) {
  if (line.plan.used <= 0) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <section aria-label="Se l'indice sale" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se l&apos;indice sale</h3>
      <p className="text-sm text-foreground">
        Il tasso è variabile. Con l&apos;utilizzato di oggi ({money(line.plan.used)}) pagheresti, al mese:
      </p>
      <ul className="grid grid-cols-3 gap-2 text-center">
        {creditLineRateScenarios(line.plan.used, line.plan.currentRate).map((row) => (
          <li key={row.points} className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-xs text-muted-foreground">+{String(row.points).replace(".", ",")} punti</p>
            <p className="font-heading text-lg font-medium tabular-nums text-foreground">
              {money(row.monthlyCost)}
              <span className="text-xs font-normal text-muted-foreground"> /mese</span>
            </p>
            <p className="text-xs tabular-nums text-neg">+{money(row.extraYearly)} l&apos;anno</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
