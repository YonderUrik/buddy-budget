import { formatAlertPrice } from "@/lib/investments/alerts";

/** Prezzo nella valuta dello strumento (più decimali sotto i 10). */
export const formatPrice = formatAlertPrice;

/** "3,1 mld" / "820 mln": grandezze grandi in forma breve (bilioni = 10¹², miliardi = 10⁹). */
export function formatCompactAmount(value: number): string {
  const abs = Math.abs(value);
  const one = (n: number) => n.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (abs >= 1e12) return `${one(value / 1e12)} bln`;
  if (abs >= 1e9) return `${one(value / 1e9)} mld`;
  if (abs >= 1e6) return `${one(value / 1e6)} mln`;
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

/** "12,3" (numero con una cifra decimale, virgola). */
export function formatRatio(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}
