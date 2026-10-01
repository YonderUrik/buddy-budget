/** Simulatore: rialzo dell'indice su una linea di credito. Quanto costerebbero gli interessi se il tasso salisse. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { creditLineRateScenarios } from "@/lib/calc/debt-simulator";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";

export interface SimulatorCreditRateCardProps {
  lines: CreditLineView[];
  currency: string;
}

export function SimulatorCreditRateCard({ lines, currency }: SimulatorCreditRateCardProps) {
  const active = lines.filter((l) => l.plan.used > 0);
  if (active.length === 0) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se l&apos;indice sale</CardTitle>
        <p className="text-sm text-foreground">Sulle linee di credito il tasso è variabile. Ecco cosa pagheresti di interessi, con l&apos;utilizzato di oggi, se salisse.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active.map((line) => (
          <div key={line.id}>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              {line.name} <span className="font-normal text-muted-foreground">· {money(line.plan.used)} al {line.plan.currentRate.toFixed(2).replace(".", ",")}%</span>
            </p>
            <ul className="grid grid-cols-3 gap-2 text-center">
              {creditLineRateScenarios(line.plan.used, line.plan.currentRate).map((row) => (
                <li key={row.points} className="rounded-lg bg-muted/50 px-2 py-2">
                  <p className="text-xs text-muted-foreground">+{String(row.points).replace(".", ",")} punti</p>
                  <p className="font-heading text-lg font-medium tabular-nums text-foreground">{money(row.monthlyCost)}<span className="text-xs font-normal text-muted-foreground"> /mese</span></p>
                  <p className="text-xs tabular-nums text-neg">+{money(row.extraYearly)} l&apos;anno</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
