"use client";

/**
 * One result of «Cerca», in the Spotlight style: round icon (or the merchant logo, or the security's mark), title with the
 * typed words in bold, a grey second part, the amount on the right. An answer to a question writes its own title and
 * line from the figures the server computed.
 */

import {
  BarChart3Icon,
  CreditCardIcon,
  FileTextIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SettingsIcon,
  SigmaIcon,
  TagIcon,
  TargetIcon,
  TrendingUpIcon,
  UmbrellaIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { MerchantLogo } from "@/components/domain/categorization/light";
import { InstrumentIcon } from "@/components/domain/investments/light";
import { formatCurrency } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { answerLine, answerTitle } from "@/lib/search/answer-text";
import { matchRanges } from "@/lib/search/normalize";
import type { SearchHit, SearchIcon } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export const SEARCH_ICONS: Record<SearchIcon, LucideIcon> = {
  totale: SigmaIcon,
  movimento: ReceiptTextIcon,
  conto: LandmarkIcon,
  titolo: TrendingUpIcon,
  categoria: TagIcon,
  abbonamento: RepeatIcon,
  debito: CreditCardIcon,
  obiettivo: TargetIcon,
  pensione: UmbrellaIcon,
  panoramica: LayoutDashboardIcon,
  liquidita: WalletIcon,
  analitiche: BarChart3Icon,
  aiuto: LifeBuoyIcon,
  pagina: FileTextIcon,
  impostazione: SettingsIcon,
  azione: PlusIcon,
};

/** `text` with the parts matching `query` (folded) in bold. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], index) => {
    if (start < at) return;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<strong key={index} className="font-semibold">{text.slice(start, end)}</strong>);
    at = end;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/** «13 movimenti · l'ultimo il 5 ott» or «5 ott · Conto corrente». */
function movementLine(hit: SearchHit, locale: string, tr: (key: string, values?: Record<string, string>) => string): string {
  const sameYear = hit.date!.slice(0, 4) === String(new Date().getFullYear());
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" }).format(new Date(`${hit.date}T12:00:00`));
  return (hit.count ?? 1) > 1 ? tr("{0} movimenti · l'ultimo il {1}", { 0: String(hit.count), 1: date }) : `${date} · ${hit.account ?? ""}`;
}

/** The round tile on the left: the merchant logo or the security's mark when there is one, the kind's icon otherwise. */
function RowTile({ hit, big, lit }: { hit: SearchHit; big: boolean; lit: boolean }) {
  const Icon = SEARCH_ICONS[hit.icon];
  const size = big ? "size-10" : "size-8";
  const tile = cn(
    "flex shrink-0 items-center justify-center rounded-full",
    size,
    hit.icon === "azione" ? "bg-sun text-on-sun" : lit ? "bg-spotlight-lit-icon text-on-spotlight-lit-icon" : "bg-foreground/[0.07] text-primary"
  );
  const icon = <Icon className={big ? "size-5" : "size-4"} aria-hidden="true" />;
  if (hit.instrument) return <InstrumentIcon type={hit.instrument.type} name={hit.instrument.name} instrumentId={hit.instrument.id} className={cn(size, "rounded-full")} />;
  if (hit.logoPath) return <MerchantLogo name={hit.title} logoPath={hit.logoPath} className={size} fallback={<span className={cn(tile, "size-full")}>{icon}</span>} />;
  return <span className={tile}>{icon}</span>;
}

export interface SearchRowProps {
  hit: SearchHit;
  query: string;
  selected: boolean;
  /** Bigger row with a bigger icon (the best result). */
  top?: boolean;
  /** Phone: taller rows, no selection fill (touch), separators by space. */
  phone?: boolean;
  currency: string;
  id: string;
  onPick: () => void;
  onHover?: () => void;
}

export function SearchRow({ hit, query, selected, top = false, phone = false, currency, id, onPick, onHover }: SearchRowProps) {
  const { t: tr, locale } = useLocalization();
  const answer = hit.answer ? { ...hit, answer: hit.answer } : null;
  // Server subtitles are Italian keys («Conto», «Abbonamento mensile»); names and ISINs pass through unchanged.
  const subtitle = answer ? answerLine(answer, locale, currency, tr) : hit.date ? movementLine(hit, locale, tr) : hit.subtitle ? tr(hit.subtitle) : undefined;
  const lit = selected && !phone;
  const income = hit.amount !== undefined && hit.amount > 0 && (hit.icon === "movimento" || (hit.answer?.kind === "totale" && hit.answer.direction === "entrate"));
  return (
    <div role="option" id={id} aria-selected={selected}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onPick}
        onMouseMove={onHover}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-left transition-colors duration-100",
          top ? "min-h-15 py-2" : phone ? "min-h-14 py-2" : "min-h-11 py-1.5",
          lit ? "bg-spotlight-lit text-on-spotlight-lit" : phone ? "active:bg-foreground/5" : "hover:bg-foreground/5"
        )}
      >
        <RowTile hit={hit} big={top || phone} lit={lit} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate leading-tight", top ? "text-[17px]" : "text-[15px]")}>
            {answer ? answerTitle(answer, locale, tr) : <Highlighted text={hit.title} query={query} />}
          </span>
          {subtitle ? <span className={cn("block truncate text-xs leading-snug", lit ? "text-on-spotlight-lit-2" : "text-text-3")}>{subtitle}</span> : null}
        </span>
        {hit.amount !== undefined ? (
          <span className={cn("shrink-0 font-heading tabular-nums", answer ? "text-base font-semibold" : "text-sm", lit ? "text-on-spotlight-lit" : income ? "text-pos" : answer ? "text-foreground" : "text-text-2")}>
            {formatCurrency(hit.amount, currency, { locale })}
          </span>
        ) : null}
      </button>
    </div>
  );
}
