"use client";

/**
 * The draft a sentence typed in «Cerca» describes («comprato 3 Apple a 50 € oggi»), shown on top of the results: what
 * will be added, the values understood and what is still missing. Picking it opens the «Aggiungi» form already filled
 * in; nothing is saved from here.
 */

import { BanknoteIcon, CoinsIcon, ReceiptTextIcon, SparklesIcon, TrendingDownIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import { missingFields, type CommandDraft, type CommandKind, type CommandMissing } from "@/lib/commands";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency, privateNumberFormat } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { SPOTLIGHT_CARD } from "./spotlight-style";

const KIND_ICONS: Record<CommandKind, LucideIcon> = { spesa: ReceiptTextIcon, entrata: BanknoteIcon, acquisto: TrendingUpIcon, vendita: TrendingDownIcon, dividendo: CoinsIcon };
const KIND_TITLES: Record<CommandKind, string> = { spesa: "Spesa", entrata: "Entrata", acquisto: "Acquisto", vendita: "Vendita", dividendo: "Dividendo" };
const MISSING_LABELS: Record<CommandMissing, string> = { importo: "l'importo", titolo: "il titolo", quantita: "la quantità", descrizione: "la descrizione" };

/** «oggi», «ieri» or the date in the user's format. */
function dayLabel(iso: string, locale: string, tr: (key: string) => string): string {
  const today = new Date();
  const date = new Date(`${iso}T12:00:00`);
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return tr("oggi");
  if (days === 1) return tr("ieri");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
}

export interface CommandCardProps {
  draft: CommandDraft;
  instrument: Instrument | null;
  selected: boolean;
  currency: string;
  phone?: boolean;
  id: string;
  onPick: () => void;
  onHover?: () => void;
}

export function CommandCard({ draft, instrument, selected, currency, phone = false, id, onPick, onHover }: CommandCardProps) {
  const { t: tr, locale } = useLocalization();
  const Icon = KIND_ICONS[draft.kind];
  const money = (value: number) => formatCurrency(value, draft.currency ?? instrument?.currency ?? currency, { locale });
  const otherCurrency = draft.currency !== null && instrument !== null && draft.currency !== instrument.currency && (draft.price !== null || draft.amount !== null) && draft.kind !== "dividendo";
  const units = privateNumberFormat(locale, { maximumFractionDigits: 6 });
  const trade = draft.kind === "acquisto" || draft.kind === "vendita";
  const name = trade || draft.kind === "dividendo" ? (instrument?.name ?? draft.subject) : draft.subject;
  const total = trade ? (draft.quantity !== null && draft.price !== null ? draft.quantity * draft.price : draft.amount) : draft.amount;
  const facts = [
    trade && draft.quantity !== null && draft.price !== null ? `${units.format(draft.quantity)} × ${money(draft.price)}` : null,
    trade && draft.quantity !== null && draft.price === null ? tr("{0} quote", { 0: units.format(draft.quantity) }) : null,
    dayLabel(draft.date, locale, tr),
  ].filter((fact): fact is string => fact !== null);
  const missing = missingFields(draft);
  const lit = selected && !phone;
  return (
    <div role="option" id={id} aria-selected={selected}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onPick}
        onMouseMove={onHover}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-3 text-left transition-colors duration-100",
          // On the phone the card is the block itself (like the other result cards); on desktop it lights up when chosen.
          phone ? cn("rounded-3xl p-4", SPOTLIGHT_CARD) : "rounded-2xl p-3",
          !phone && (lit ? "bg-sun text-on-sun" : "bg-foreground/[0.05] hover:bg-foreground/[0.08]")
        )}
      >
        <span className="flex w-full items-center gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", lit ? "bg-on-sun text-sun" : "bg-sun text-on-sun")}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[17px] font-semibold leading-tight", phone ? "line-clamp-2" : "truncate")}>
              {tr(KIND_TITLES[draft.kind])}
              {name ? <span className="font-normal"> · {name}</span> : null}
            </span>
            <span className={cn("block truncate text-sm", lit ? "text-on-sun/75" : "text-text-2")}>{facts.join(" · ")}</span>
          </span>
          {total !== null ? (
            <span className={cn("shrink-0 font-heading tabular-nums", phone ? "text-lg" : "text-xl", !lit && draft.kind === "entrata" && "text-pos")}>
              {money(draft.kind === "spesa" || draft.kind === "acquisto" ? -total : total)}
            </span>
          ) : null}
        </span>
        <span className={cn("flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs", lit ? "text-on-sun/75" : "text-text-3")}>
          {draft.source === "ai" ? (
            <span className="inline-flex items-center gap-1">
              <SparklesIcon className="size-3.5" aria-hidden="true" />
              {tr("Capito dall'AI")}
            </span>
          ) : null}
          {missing.length > 0 ? <span className={cn(!lit && "text-neg")}>{tr("Manca {0}", { 0: missing.map((m) => tr(MISSING_LABELS[m])).join(", ") })}</span> : null}
          {trade && !instrument && draft.subject ? <span>{tr("Il titolo lo scegli nel modulo")}</span> : null}
          {otherCurrency ? <span>{tr("{0} è quotato in {1}: il prezzo lo controlli nel modulo", { 0: instrument.name, 1: instrument.currency })}</span> : null}
          <span className="ml-auto">{phone ? tr("Tocca per controllare e salvare") : tr("⏎ apre il modulo già compilato: controlli tu prima di salvare")}</span>
        </span>
      </button>
    </div>
  );
}

/** «Chiedi all'AI» for a sentence the rules could not read, with what happened after asking. */
export function AiRow({ status, selected, phone = false, id, onPick, onHover }: { status: string; selected: boolean; phone?: boolean; id: string; onPick: () => void; onHover?: () => void }) {
  const { t: tr } = useLocalization();
  const lines: Record<string, string> = {
    idle: "Prova a capire la frase e prepara il modulo",
    loading: "Sto leggendo la frase…",
    none: "Non sembra una spesa, un'entrata o un'operazione",
    invalid: "Frase troppo lunga o senza parole",
    disabled: "Prima attiva l'assistente AI in Impostazioni › Notifiche e AI",
    unavailable: "Non disponibile in questa versione",
    limited: "Hai fatto molte domande: riprova tra un po'",
    failed: "Non ha risposto: riprova",
  };
  const lit = selected && !phone;
  return (
    <div role="option" id={id} aria-selected={selected}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onPick}
        onMouseMove={onHover}
        disabled={status === "loading"}
        className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-100", phone ? "min-h-14" : "min-h-12", lit ? "bg-sun text-on-sun" : "hover:bg-foreground/5")}
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", lit ? "bg-on-sun/10" : "bg-foreground/[0.07] text-primary")}>
          <SparklesIcon className={cn("size-[18px]", status === "loading" && "animate-pulse")} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-tight">{tr("Chiedi all'AI")}</span>
          <span className={cn("block truncate text-xs", lit ? "text-on-sun/70" : "text-text-3")}>{tr(lines[status] ?? lines.idle)}</span>
        </span>
      </button>
    </div>
  );
}
