/** "4,2%" (senza segno), con i decimali richiesti. */
export function formatPct(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals).replace(".", ",")}%`;
}

const MONTH_SHORT = new Intl.DateTimeFormat("it-IT", { month: "short" });

/** "YYYY-MM" o numero del mese (1-12) → "set". */
export function shortMonthLabel(month: string | number): string {
  const index = typeof month === "number" ? month - 1 : Number(month.slice(5, 7)) - 1;
  return MONTH_SHORT.format(new Date(2000, index, 1)).replace(".", "");
}
