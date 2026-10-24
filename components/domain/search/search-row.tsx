"use client";

/** One result of «Cerca», in the Spotlight style: round icon, title with the typed words in bold, a grey second part, the amount on the right. */

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
  TagIcon,
  TargetIcon,
  TrendingUpIcon,
  UmbrellaIcon,
  WalletIcon,
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
  const Icon = SEARCH_ICONS[hit.icon];
  const action = hit.icon === "azione";
  // Server subtitles are Italian keys («Conto», «Abbonamento mensile»); names and ISINs pass through unchanged.
  const subtitle = hit.date ? movementLine(hit, locale, tr) : hit.subtitle ? tr(hit.subtitle) : undefined;
  const lit = selected && !phone;
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
          lit ? "bg-sun text-on-sun" : phone ? "active:bg-foreground/5" : "hover:bg-foreground/5"
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full",
            top || phone ? "size-10" : "size-8",
            action ? (lit ? "bg-on-sun text-sun" : "bg-sun text-on-sun") : lit ? "bg-on-sun/10 text-on-sun" : "bg-foreground/[0.07] text-primary"
          )}
        >
          <Icon className={top || phone ? "size-5" : "size-4"} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate leading-tight", top ? "text-[17px]" : "text-[15px]")}>
            <Highlighted text={hit.title} query={query} />
          </span>
          {subtitle ? <span className={cn("block truncate text-xs leading-snug", lit ? "text-on-sun/70" : "text-text-3")}>{subtitle}</span> : null}
        </span>
        {hit.amount !== undefined ? (
          <span className={cn("shrink-0 font-heading text-sm tabular-nums", lit ? "text-on-sun" : hit.amount > 0 && hit.icon === "movimento" ? "text-pos" : "text-text-2")}>
            {formatCurrency(hit.amount, currency, { locale })}
          </span>
        ) : null}
      </button>
    </div>
  );
}
