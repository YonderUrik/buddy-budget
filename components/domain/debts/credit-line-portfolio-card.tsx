/** Linea di credito contro il portafoglio: quanto pesa l'utilizzato sugli investimenti e cosa succede se il mercato scende. */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCreditLinePortfolioView } from "@/lib/debts/credit-line-portfolio";
import { formatCurrency } from "@/lib/format";

export interface CreditLinePortfolioCardProps {
  /** Utilizzato della linea oggi. */
  used: number;
  /** Tasso totale annuo della linea (indice + spread), in %. */
  currentRate: number;
  /** Valore del portafoglio investimenti oggi. */
  portfolioValue: number;
  currency: string;
}

const PERCENT_DIGITS = 1;

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(PERCENT_DIGITS).replace(".", ",")}%`;
}

export function CreditLinePortfolioCard({ used, currentRate, portfolioValue, currency }: CreditLinePortfolioCardProps) {
  const view = buildCreditLinePortfolioView(used, portfolioValue);
  if (view.ratio === null) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rispetto ai tuoi investimenti</CardTitle>
        <p className="text-sm text-foreground">
          Hai usato <span className="font-medium tabular-nums">{money(used)}</span>, il {pct(view.ratio)} del portafoglio ({money(portfolioValue)}). Il credito ti costa il {currentRate.toFixed(2).replace(".", ",")}% l&apos;anno.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="grid grid-cols-3 gap-2 text-center">
          {view.drops.map((row) => (
            <li key={row.drop} className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-xs text-muted-foreground">Se il mercato scende del {Math.round(row.drop * 100)}%</p>
              <p className="font-heading text-lg font-medium tabular-nums text-foreground">{pct(row.ratio)}</p>
              <p className="text-xs text-muted-foreground">del portafoglio</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Calcolo semplice, non conosce le regole del tuo contratto (percentuali di garanzia per titolo, margin call).{" "}
          <Link href="/investimenti" className="underline underline-offset-2">Vai agli investimenti</Link>
        </p>
      </CardContent>
    </Card>
  );
}
