"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * "Dove sta il tuo patrimonio": una barra divisa per classe di asset, una frase sulla quota investita e una riga per
 * classe (valore, peso, una sola cifra di sintesi) che porta alla sua sezione. Riassunto, non analisi: i dettagli
 * restano nelle pagine Conti e Investimenti.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

import { cn } from "@/lib/utils";
import { SECTION_TITLE } from "@/components/domain/shared";
import { assetClassColor } from "./asset-classes";
import { computeInvestedShare, type NetWorthCompositionItem } from "./net-worth-composition-row.utils";

export interface NetWorthCompositionRowProps {
  items: NetWorthCompositionItem[];
  currency: string;
  title?: string;
  /** Classi aggiuntive sulla card (es. per toglierle il riquadro quando sta aperta sulla pagina). */
  className?: string;
  /** Chiamata quando una fetta viene bloccata con un clic o un tocco (non allo sblocco). */
  onSliceSelect?: (key: string) => void;
}

/** Opacità delle fette non evidenziate mentre una è in primo piano. */
const DIMMED_SLICE_OPACITY = 0.35;

/** Whole percentage in the user's locale ("25%" in Italian, "25 %" in German). */
function percent(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** Invested share in words, in the user's language. */
function investedSentence(share: number, locale: string, tr: (source: string, values?: Record<string, string>) => string): string {
  if (share === 0) return tr("Per ora è tutto liquidità.");
  return tr("Il {0} è investito, il resto è liquidità.", { 0: percent(share, locale) });
}

export function NetWorthCompositionRow({ items, currency, title = "Dove sta il tuo patrimonio", className, onSliceSelect }: NetWorthCompositionRowProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatSignedPct: signedPercent } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const [lockedKey, setLockedKey] = React.useState<string | null>(null);
  if (items.length === 0) return null;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const colorFor = assetClassColor;
  const investedShare = computeInvestedShare(items);
  const assetCount = items.filter((i) => !i.isLiability).length;
  const pieItems = items.filter((i) => !i.isLiability && i.share > 0);
  const showPie = assetCount > 1 && pieItems.length > 0;
  const pieData = pieItems.map((item) => ({ key: item.key, name: item.label, value: item.share, fill: colorFor(item.key) }));
  const focusKey = hoveredKey ?? lockedKey;
  const focusItem = pieItems.find((item) => item.key === focusKey) ?? null;
  const toggleLocked = (key: string) => {
    if (lockedKey !== key) onSliceSelect?.(key);
    setLockedKey((current) => (current === key ? null : key));
  };
  const pieConfig: ChartConfig = Object.fromEntries(pieItems.map((item) => [item.label, { label: item.label, color: colorFor(item.key) }]));
  const pieSummary = tr("Composizione del patrimonio: {0}.", { 0: pieItems.map((item) => `${tr(item.label)} ${percent(item.share, formattingLocale)}`).join(", ") });

  return (
    <Card className={className}>
      <CardHeader className="gap-1">
        <CardTitle className={SECTION_TITLE}>{tr(title)}</CardTitle>
        {investedShare !== null && !showPie ? <p className="text-sm text-foreground">{investedSentence(investedShare, formattingLocale, tr)}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {showPie ? (
          <div className="relative size-48 shrink-0" role="img" aria-label={pieSummary}>
            <ChartContainer config={pieConfig} className="aspect-square size-48">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={2}
                  cornerRadius={4}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => setHoveredKey(pieData[index]?.key ?? null)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={(_, index) => {
                    const key = pieData[index]?.key;
                    if (key) toggleLocked(key);
                  }}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.fill}
                      fillOpacity={focusKey && focusKey !== entry.key ? DIMMED_SLICE_OPACITY : 1}
                      className="cursor-pointer outline-none transition-opacity"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              {focusItem ? (
                <>
                  <span className="max-w-full truncate text-xs text-muted-foreground">{tr(focusItem.label)}</span>
                  <span className="font-heading text-lg font-medium tabular-nums text-foreground">{format(focusItem.amount)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{percent(focusItem.share, formattingLocale)}{" "}{tr("del totale")}</span>
                </>
              ) : investedShare !== null ? (
                <>
                  <span className="font-heading text-2xl font-medium tabular-nums text-foreground">{percent(investedShare, formattingLocale)}</span>
                  <span className="text-xs text-muted-foreground">{tr("investito")}</span>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <ul className="flex w-full min-w-0 flex-1 flex-col">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(item.key)}
                onBlur={() => setHoveredKey(null)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  focusKey === item.key && "bg-muted/60",
                  lockedKey === item.key && "bg-muted/60 ring-1 ring-ring",
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(item.key) }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{tr(item.label)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                    {assetCount > 1 && !item.isLiability ? (
                      <>
                        {` · ${percent(item.share, formattingLocale)}`}
                        <span className="hidden sm:inline">{" "}{tr("del totale")}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-medium tabular-nums text-foreground">{format(item.amount)}</span>
                  {item.highlight ? (
                    <span className={cn("block whitespace-nowrap text-xs tabular-nums", item.highlight.amount < 0 ? "text-neg" : "text-pos")}>
                      {item.highlight.amount < 0 ? "−" : "+"}
                      {format(Math.abs(item.highlight.amount))}
                      {item.highlight.ratio !== null ? ` (${signedPercent(item.highlight.ratio)})` : ""}{" "}
                      <span className="hidden text-muted-foreground sm:inline">{tr(item.highlight.label)}</span>
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
