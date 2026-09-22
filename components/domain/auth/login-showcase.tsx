/**
 * LoginShowcase
 *
 * Pannello illustrativo delle pagine di autenticazione: mostra il prodotto con i suoi stessi elementi
 * (patrimonio netto nel tempo, movimenti categorizzati) invece di un'illustrazione generica.
 * Tutti i numeri sono dati di esempio fissi, dichiarati come tali nell'interfaccia.
 */

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Andamento di esempio del patrimonio netto (valori relativi, normalizzati sul grafico). */
const SAMPLE_SERIES = [31, 33, 32, 36, 35, 39, 38, 42, 41, 45, 47, 46, 50] as const;
const SAMPLE_NET_WORTH = 48230;
const SAMPLE_CHANGE_LABEL = "+2,4% negli ultimi 3 mesi";

interface SampleTransaction {
  merchant: string;
  category: string;
  /** Token colore categoria (variabile CSS esistente in globals.css). */
  swatchVar: string;
  amount: number;
}

const SAMPLE_TRANSACTIONS: SampleTransaction[] = [
  { merchant: "Stipendio", category: "Entrate", swatchVar: "--swatch-emerald", amount: 2150 },
  { merchant: "Esselunga", category: "Spesa", swatchVar: "--swatch-amber", amount: -48.2 },
  { merchant: "Netflix", category: "Abbonamenti", swatchVar: "--swatch-violet", amount: -12.99 },
];

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;

/** Costruisce i tracciati SVG di linea e area per una serie di valori, scalata nel riquadro del grafico. */
function buildChartPaths(values: readonly number[]): { line: string; area: string } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((v - min) / span) * (CHART_HEIGHT - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z` };
}

export interface LoginShowcaseProps {
  className?: string;
}

export function LoginShowcase({ className }: LoginShowcaseProps) {
  const { line, area } = buildChartPaths(SAMPLE_SERIES);

  return (
    <figure className={cn("w-full max-w-sm", className)} aria-label="Esempio di panoramica BuddyBudget">
      <figcaption className="flex items-baseline justify-between text-sm text-primary-foreground/70">
        <span>Patrimonio netto</span>
        <span className="text-xs text-primary-foreground/50">dati di esempio</span>
      </figcaption>
      <p className="mt-1 font-heading text-5xl font-medium tracking-tight tabular-nums xl:text-6xl">
        {formatCurrency(SAMPLE_NET_WORTH, "EUR", { maximumFractionDigits: 0 })}
      </p>
      <p className="mt-1 text-sm text-primary-foreground/70">{SAMPLE_CHANGE_LABEL}</p>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="mt-6 h-24 w-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={area} className="fill-primary-foreground/10" />
        <path
          d={line}
          pathLength={1}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary-foreground [stroke-dasharray:1] motion-safe:animate-draw-line"
        />
      </svg>

      <ul className="mt-8 divide-y divide-primary-foreground/15 border-y border-primary-foreground/15">
        {SAMPLE_TRANSACTIONS.map((t) => (
          <li key={t.merchant} className="flex items-center gap-3 py-3 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${t.swatchVar})` }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">
              {t.merchant}
              <span className="text-primary-foreground/50"> · {t.category}</span>
            </span>
            <span className="font-heading tabular-nums">
              {t.amount > 0 ? "+" : ""}
              {formatCurrency(t.amount, "EUR")}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
