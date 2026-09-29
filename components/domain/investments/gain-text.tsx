/** Guadagno con segno e percentuale ("+120 € · +4,5%"), verde o rosso secondo il segno. */

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "+4,5%" / "−2,0%". */
export function formatSignedPct(ratio: number): string {
  return `${ratio < 0 ? "−" : "+"}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

/** "+120,50 €" / "−3,20 €". */
export function formatSignedCurrency(amount: number, currency: string): string {
  return `${amount < 0 ? "−" : "+"}${formatCurrency(Math.abs(amount), currency)}`;
}

export interface GainTextProps {
  gain: number;
  pct?: number | null;
  currency: string;
  className?: string;
}

export function GainText({ gain, pct = null, currency, className }: GainTextProps) {
  return (
    <span className={cn("tabular-nums", gain < 0 ? "text-neg" : "text-pos", className)}>
      {formatSignedCurrency(gain, currency)}
      {pct !== null ? ` · ${formatSignedPct(pct)}` : ""}
    </span>
  );
}
