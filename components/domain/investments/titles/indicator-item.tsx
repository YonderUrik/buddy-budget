"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Un indicatore della pagina titolo: etichetta con il «?» che apre il calcolo con i numeri veri, valore grande,
 * forbice degli esercizi passati (se c'è) e una frase. Usato da tutte le sezioni dei fondamentali.
 */

import type { ReactNode } from "react";
import { CircleHelpIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { track } from "@/lib/analytics";
import type { Indicator, IndicatorRange } from "@/lib/investments/title-fundamentals";
import { formatIndicator, formatOperand, type IndicatorFormat } from "./indicator-meta";

export interface IndicatorExplanation {
  /** Chiave statica per l'evento di analisi (es. "pe"). */
  id: string;
  title: string;
  formula: string;
  /** Il calcolo con i numeri veri, se l'indicatore è calcolato dall'app. */
  indicator?: Indicator | null;
  format?: IndicatorFormat;
  /** Valuta di bilancio (termini della formula) e di quotazione (prezzo). */
  currency?: string;
  priceCurrency?: string;
  source: string;
}

/** Popover «come si calcola»: formula in parole, poi la divisione con i numeri del titolo e la fonte. */
export function IndicatorHelp({ id, title, formula, indicator, format = "multiple", currency = "", priceCurrency = currency, source }: IndicatorExplanation) {
  const { t: tr } = useLocalization();
  return (
    <Popover onOpenChange={(open) => open && track("title_indicator_opened", { indicator: id })}>
      <PopoverTrigger
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={tr("Come si calcola: {0}", {0: title})}
      >
        <CircleHelpIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="flex max-w-80 flex-col gap-2 text-sm">
        <p className="font-heading font-medium text-foreground">{tr(title)}</p>
        <p className="text-muted-foreground">{formula}</p>
        {indicator ? (
          <p className="rounded-lg bg-muted px-3 py-2 font-heading tabular-nums text-foreground">
            {formatOperand(indicator.numerator, currency, priceCurrency)}{" "}{tr("÷")}{" "}{formatOperand(indicator.denominator, currency, priceCurrency)} ={" "}
            <span className="font-medium">{formatIndicator(indicator.value, format)}</span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{source}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Barra della forbice: fascia tra minimo e massimo, tacca sulla media, pallino sul valore di oggi. */
function RangeBar({ range, value, format }: { range: IndicatorRange; value: number; format: IndicatorFormat }) {
  const { t: tr } = useLocalization();
  const low = Math.min(range.min, value);
  const high = Math.max(range.max, value);
  const span = high - low || 1;
  const at = (v: number) => `${((v - low) / span) * 100}%`;
  return (
    <div className="mt-2">
      <div
        className="relative h-1.5 rounded-full bg-muted"
        role="img"
        aria-label={tr("Oggi {0}; negli ultimi {1} esercizi tra {2} e {3}, media {4}", {0: formatIndicator(value, format), 1: range.years, 2: formatIndicator(range.min, format), 3: formatIndicator(range.max, format), 4: formatIndicator(range.average, format)})}
      >
        <span className="absolute inset-y-0 rounded-full bg-primary/25" style={{ left: at(range.min), right: `calc(100% - ${at(range.max)})` }} />
        <span className="absolute -inset-y-1 w-0.5 rounded-full bg-muted-foreground" style={{ left: at(range.average) }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ left: at(value) }} />
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{tr("min")}{" "}{formatIndicator(range.min, format)}</span>
        <span>{tr("max")}{" "}{formatIndicator(range.max, format)}</span>
      </div>
    </div>
  );
}

export interface IndicatorItemProps {
  label: string;
  /** Valore già formattato, o un nodo (es. con il colore del segno). */
  value: ReactNode;
  hint: string;
  help?: IndicatorExplanation;
  /** Testo accanto al valore (es. "media 5 anni +2,3%"). */
  aside?: string;
  range?: { range: IndicatorRange; value: number; format: IndicatorFormat } | null;
}

export function IndicatorItem({ label, value, hint, help, aside, range }: IndicatorItemProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {tr(label)}
        {help ? <IndicatorHelp {...help} /> : null}
      </dt>
      <dd className="font-heading text-xl font-medium tabular-nums text-foreground">
        {value}
        {aside ? <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">{aside}</span> : null}
      </dd>
      {range ? <RangeBar {...range} /> : null}
      <p className="mt-0.5 text-xs text-muted-foreground">{tr(hint)}</p>
    </div>
  );
}
