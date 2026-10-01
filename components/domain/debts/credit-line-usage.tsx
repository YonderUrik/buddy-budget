/** Quanto della linea è usato: barra utilizzato/fido con il segno della soglia di allerta, e l'avviso quando scatta. */

import { TriangleAlert } from "lucide-react";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CreditLineUsageProps {
  line: CreditLineView;
  currency: string;
}

/** Posizione (% della barra) della soglia di allerta, o null senza soglia. */
export function thresholdPosition(line: Pick<CreditLineView, "alertThreshold" | "creditLimit">): number | null {
  if (!line.alertThreshold || line.creditLimit <= 0) return null;
  const amount = line.alertThreshold.type === "percent" ? (line.creditLimit * line.alertThreshold.value) / 100 : line.alertThreshold.value;
  return Math.min(100, Math.max(0, (amount / line.creditLimit) * 100));
}

/** Frase che spiega perché l'utilizzo è in allerta o oltre il fido (null se tutto a posto). */
export function usageAlertText(line: CreditLineView, money: (value: number) => string): string | null {
  if (line.plan.overLimit) return `Hai superato il fido di ${money(line.plan.used - line.creditLimit)}.`;
  if (!line.alertTriggered || !line.alertThreshold) return null;
  const { type, value } = line.alertThreshold;
  const label = type === "percent" ? `${String(value).replace(".", ",")}% del fido` : money(value);
  return `L'utilizzato ha raggiunto la tua soglia di allerta (${label}).`;
}

export function CreditLineUsage({ line, currency }: CreditLineUsageProps) {
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const share = Math.min(1, line.plan.usageRatio);
  const marker = thresholdPosition(line);
  const alert = usageAlertText(line, money);
  const alerting = line.alertTriggered || line.plan.overLimit;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-3xl font-medium tabular-nums text-foreground">{money(line.plan.used)}</p>
        <p className="text-sm text-muted-foreground">
          su {money(line.creditLimit)} di fido · <span className="tabular-nums">{Math.round(line.plan.usageRatio * 100)}%</span>
        </p>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Utilizzato ${money(line.plan.used)} su ${money(line.creditLimit)}, ${Math.round(line.plan.usageRatio * 100)}% del fido`}
      >
        <span className={cn("block h-full rounded-full", alerting ? "bg-neg" : "bg-primary")} style={{ width: `${share * 100}%` }} />
        {marker !== null ? <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${marker}%` }} aria-hidden="true" /> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {line.plan.available >= 0 ? `${money(line.plan.available)} ancora disponibili` : "Fido esaurito"}
        {marker !== null ? " · il segno sulla barra è la tua soglia" : ""}
      </p>
      {alert ? (
        <p className="flex items-start gap-2 rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg" role="status">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {alert}
        </p>
      ) : null}
    </div>
  );
}
