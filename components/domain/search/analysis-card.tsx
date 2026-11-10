"use client";

/**
 * The answer to an analysis in «Cerca» («quanto spendo in media al mese al supermercato», «in quale mese ho speso di
 * più»): what the figure is, the figure in big, how it was made and how it changed, «Cosa ho capito» as chips (a wrong
 * reading shows at a glance), then the split, the bars or the movements. Picking the card (Enter, or a tap on its top)
 * opens Movimenti on the same filter; each row opens its own part. Every figure was computed by the server.
 */

import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { analysisChips, analysisComparison, analysisKicker, analysisLine, analysisTitle, formatFigure, type AnalysisAnswer } from "@/lib/search/analysis-text";
import type { AnalysisLinkedRow, SearchHit } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { AnalysisRows } from "./analysis-rows";
import { SPOTLIGHT_CARD } from "./spotlight-style";

export interface AnalysisCardProps {
  hit: SearchHit & { answer: AnalysisAnswer };
  selected: boolean;
  currency: string;
  phone?: boolean;
  id: string;
  /** The whole answer: Movimenti on the same filter and period. */
  onPick: () => void;
  /** One row: Movimenti on that category, merchant, account or month, or the movement's detail. */
  onOpenRow: (row: AnalysisLinkedRow) => void;
  onHover?: () => void;
}

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function AnalysisCard({ hit, selected, currency, phone = false, id, onPick, onOpenRow, onHover }: AnalysisCardProps) {
  const { t: tr, locale } = useLocalization();
  const answer = hit.answer;
  const { result } = answer;
  const today = localToday();
  const kicker = analysisKicker(answer, tr);
  const comparison = analysisComparison(answer, locale, tr, today);
  const figure = result.value === null ? null : formatFigure(answer, result.value, currency, locale, tr);
  const income = result.unit === "denaro" && result.value !== null && (answer.query.direction === "entrate" || (answer.query.direction === "netto" && result.value > 0));
  const lit = selected && !phone;
  return (
    <div role="option" id={id} aria-selected={selected} onMouseMove={onHover} className={cn("flex flex-col gap-3 transition-colors duration-100", phone ? cn("rounded-3xl p-3", SPOTLIGHT_CARD) : cn("rounded-2xl p-2", lit ? "bg-spotlight-lit" : "bg-foreground/[0.04]"))}>
      <button type="button" tabIndex={-1} onClick={onPick} className="flex w-full cursor-pointer flex-col gap-1 rounded-xl px-2 pt-1 text-left">
        {kicker ? <span className="text-xs font-medium text-text-3">{kicker}</span> : null}
        <span className="flex w-full items-start justify-between gap-3">
          <span className="text-[15px] font-medium leading-tight text-text-2">{analysisTitle(answer, locale, tr)}</span>
          <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden="true" />
        </span>
        {figure ? <span className={cn("font-heading text-[34px] font-semibold leading-none tabular-nums", income && "text-pos")}>{figure}</span> : null}
        <span className="text-xs leading-snug text-text-3">{analysisLine(answer, locale, tr, currency)}</span>
        {comparison ? <span className={cn("text-xs font-medium", comparison.tone === "pos" ? "text-pos" : comparison.tone === "neg" ? "text-neg" : "text-text-2")}>{comparison.text}</span> : null}
      </button>
      {result.value !== null ? <AnalysisRows answer={answer} currency={currency} phone={phone} onOpenRow={onOpenRow} /> : null}
      <div className="flex flex-col gap-1.5 px-2 pb-1">
        <span className="inline-flex items-center gap-1 text-xs text-text-3">
          <SparklesIcon className="size-3.5" aria-hidden="true" />
          {tr("Cosa ho capito")}
        </span>
        <ul className="flex flex-wrap gap-1.5" aria-label={tr("Cosa ho capito")}>
          {analysisChips(answer, currency, locale, tr, today).map((chip) => (
            <li key={chip} className="rounded-full bg-foreground/[0.07] px-2.5 py-1 text-xs">
              {chip}
            </li>
          ))}
        </ul>
        <span className="pt-1 text-xs text-text-3">{phone ? tr("Tocca un numero per vedere i movimenti") : tr("⏎ apre i movimenti · i conti li fa l'app, l'AI legge solo la domanda")}</span>
      </div>
    </div>
  );
}
