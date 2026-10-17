/** Unsigned percentage with the requested decimals, in the user's locale ("4,2%" in it-IT, "4.2%" in en-GB, "4,2 %" in de-DE). */
export function formatPct(ratio: number, decimals = 1, locale = "it-IT"): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(ratio);
}

/** Percentage with an explicit sign and a typographic minus ("+4,5%" / "−2,0%" in it-IT). */
export function formatSignedPct(ratio: number, locale = "it-IT", decimals = 1): string {
  return `${ratio < 0 ? "−" : "+"}${formatPct(Math.abs(ratio), decimals, locale)}`;
}

/** Percentage whose leading hyphen becomes a typographic minus ("−12,3%"), without a "+" on positives. */
export function formatMinusPct(ratio: number, decimals = 1, locale = "it-IT"): string {
  return formatPct(ratio, decimals, locale).replace(/^-/, "−");
}

/** Plain decimal number in the user's locale ("0,85" in it-IT, "0.85" in en-GB), without grouping. */
export function formatDecimal(value: number, decimals: number, locale = "it-IT"): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(value);
}

/** "YYYY-MM" or month number (1-12) → short month name ("set" in it-IT, "Sept" in en-GB). */
export function shortMonthLabel(month: string | number, locale = "it-IT"): string {
  const index = typeof month === "number" ? month - 1 : Number(month.slice(5, 7)) - 1;
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, index, 1)).replace(".", "");
}
