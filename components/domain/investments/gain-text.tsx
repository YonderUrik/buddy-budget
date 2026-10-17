"use client";
import { useLocalization } from "@/lib/localization/provider";
import { localizedFormats } from "@/lib/localization/format";
/** Guadagno con segno e percentuale ("+120 € · +4,5%"), verde o rosso secondo il segno. */

import { cn } from "@/lib/utils";
import { formatSignedPct as signedPct } from "./percent";

/** "+4,5%" / "−2,0%" in it-IT; follows `locale` ("+4.5%" in en-GB). */
export function formatSignedPct(ratio: number, locale = "it-IT"): string {
  return signedPct(ratio, locale);
}

/** "+120,50 €" / "−3,20 €" in it-IT; follows `locale`. */
export function formatSignedCurrency(amount: number, currency: string, locale = "it-IT"): string {
  return localizedFormats(locale).formatSignedCurrency(amount, currency);
}

export interface GainTextProps {
  gain: number;
  pct?: number | null;
  currency: string;
  className?: string;
}

export function GainText({ gain, pct = null, currency, className }: GainTextProps) {
  const { locale } = useLocalization();
  const { formatSignedCurrency, formatSignedPct } = localizedFormats(locale);
  return (
    <span className={cn("tabular-nums", gain < 0 ? "text-neg" : "text-pos", className)}>
      {formatSignedCurrency(gain, currency)}
      {pct !== null ? ` · ${formatSignedPct(pct)}` : ""}
    </span>
  );
}
