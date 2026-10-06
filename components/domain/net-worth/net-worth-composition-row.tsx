/**
 * "Dove sta il tuo patrimonio": una barra divisa per classe di asset, una frase sulla quota investita e una riga per
 * classe (valore, peso, una sola cifra di sintesi) che porta alla sua sezione. Riassunto, non analisi: i dettagli
 * restano nelle pagine Conti e Investimenti.
 */

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetClassColor } from "./asset-classes";
import { computeInvestedShare, type NetWorthCompositionItem } from "./net-worth-composition-row.utils";

export interface NetWorthCompositionRowProps {
  items: NetWorthCompositionItem[];
  currency: string;
  title?: string;
  /** Classi aggiuntive sulla card (es. per toglierle il riquadro quando sta aperta sulla pagina). */
  className?: string;
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function signedPercent(ratio: number): string {
  return `${ratio < 0 ? "−" : "+"}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

function investedSentence(share: number): string {
  if (share === 0) return "Per ora è tutto liquidità.";
  return `Il ${percent(share)} è investito, il resto è liquidità.`;
}

export function NetWorthCompositionRow({ items, currency, title = "Dove sta il tuo patrimonio", className }: NetWorthCompositionRowProps) {
  if (items.length === 0) return null;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const colorFor = assetClassColor;
  const investedShare = computeInvestedShare(items);
  const assetCount = items.filter((i) => !i.isLiability).length;
  const showBar = assetCount > 1 && items.some((i) => i.share > 0);

  return (
    <Card className={className}>
      <CardHeader className="gap-1">
        <CardTitle className="font-heading text-lg font-medium text-foreground">{title}</CardTitle>
        {investedShare !== null ? <p className="text-sm text-foreground">{investedSentence(investedShare)}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {showBar ? (
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {items
              .filter((i) => i.share > 0)
              .map((item) => (
                <div key={item.key} className="h-full" style={{ flexGrow: item.share, backgroundColor: colorFor(item.key) }} />
              ))}
          </div>
        ) : null}
        <ul className="-mx-2 flex flex-col">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor(item.key) }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                    {assetCount > 1 && !item.isLiability ? (
                      <>
                        {` · ${percent(item.share)}`}
                        <span className="hidden sm:inline"> del totale</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-heading text-base font-medium tabular-nums text-foreground">{format(item.amount)}</span>
                  {item.highlight ? (
                    <span className={cn("block text-xs tabular-nums", item.highlight.amount < 0 ? "text-neg" : "text-pos")}>
                      {item.highlight.amount < 0 ? "−" : "+"}
                      {format(Math.abs(item.highlight.amount))}
                      {item.highlight.ratio !== null ? ` (${signedPercent(item.highlight.ratio)})` : ""}{" "}
                      <span className="text-muted-foreground">{item.highlight.label}</span>
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
