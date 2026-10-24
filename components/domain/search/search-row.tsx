"use client";

/** One result of the app-wide search: icon, title with the typed words in bold, second line, amount on the right. */

import {
  ArrowUpRightIcon,
  CreditCardIcon,
  FileTextIcon,
  LandmarkIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SettingsIcon,
  TagIcon,
  TargetIcon,
  TrendingUpIcon,
  UmbrellaIcon,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { matchRanges } from "@/lib/search/normalize";
import type { SearchHit, SearchIcon } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export const SEARCH_ICONS: Record<SearchIcon, LucideIcon> = {
  movimento: ReceiptTextIcon,
  conto: LandmarkIcon,
  titolo: TrendingUpIcon,
  categoria: TagIcon,
  abbonamento: RepeatIcon,
  debito: CreditCardIcon,
  obiettivo: TargetIcon,
  pensione: UmbrellaIcon,
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
    parts.push(<strong key={index} className="font-semibold text-foreground">{text.slice(start, end)}</strong>);
    at = end;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/** «13 movimenti · l'ultimo il 5 ott» or «5 ott · Conto corrente». */
function movementLine(hit: SearchHit, locale: string, tr: (key: string, values?: Record<string, string>) => string): string {
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: hit.date!.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" }).format(new Date(`${hit.date}T12:00:00`));
  return (hit.count ?? 1) > 1 ? tr("{0} movimenti · l'ultimo il {1}", { 0: String(hit.count), 1: date }) : `${date} · ${hit.account ?? ""}`;
}

export interface SearchRowProps {
  hit: SearchHit;
  query: string;
  active: boolean;
  currency: string;
  locale: string;
  id: string;
  onPick: () => void;
  onHover: () => void;
}

export function SearchRow({ hit, query, active, currency, locale, id, onPick, onHover }: SearchRowProps) {
  const Icon = SEARCH_ICONS[hit.icon];
  const action = hit.icon === "azione";
  const { t: tr } = useLocalization();
  const subtitle = hit.date ? movementLine(hit, locale, tr) : hit.subtitle;
  return (
    <li role="option" id={id} aria-selected={active}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onPick}
        onMouseMove={onHover}
        className={cn("flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors", active ? "bg-muted" : "hover:bg-muted/60")}
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", action ? "bg-sun text-on-sun" : active ? "bg-background text-primary dark:bg-card" : "bg-muted text-primary dark:bg-background/70")}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-tight text-text-2">
            <Highlighted text={hit.title} query={query} />
          </span>
          {subtitle ? <span className="block truncate text-xs leading-snug text-text-3">{subtitle}</span> : null}
        </span>
        {hit.amount !== undefined ? (
          <span className={cn("shrink-0 font-heading text-sm tabular-nums", hit.icon === "movimento" || hit.icon === "abbonamento" ? (hit.amount < 0 ? "text-foreground" : "text-pos") : "text-text-2")}>
            {formatCurrency(hit.amount, currency, { locale })}
          </span>
        ) : (
          <ArrowUpRightIcon className={cn("size-4 shrink-0 text-text-3 transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden="true" />
        )}
      </button>
    </li>
  );
}
