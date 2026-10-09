"use client";

/**
 * Riepilogo finanziario della sidebar: "Oggi" (patrimonio), "Portafoglio" (totale e posizioni) e "Watchlist". Ogni
 * sezione si apre e si chiude e da chiusa resta a una riga. L'occhio nasconde tutti gli importi. Da sidebar compressa
 * mostra solo la variazione del giorno del portafoglio. Non renderizza nulla se non c'è niente da mostrare.
 */

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { formatSignedPct } from "@/components/domain/investments";
import { CollapsibleSection } from "@/components/domain/shared";
import type { SidebarSummary } from "@/lib/sidebar/types";
import { usePensionInNetWorth } from "@/lib/hooks/use-pension-in-net-worth";
import { cn } from "@/lib/utils";
import { InsightRow } from "./insight-row";
import {
  changeToneClass,
  formatSidebarAmount,
  formatSidebarPrice,
  formatSidebarSignedAmount,
  MAX_HOLDINGS_SHOWN,
  MAX_WATCHLIST_SHOWN,
} from "./sidebar-insights.utils";

export interface SidebarInsightsProps {
  /** Dati caricati, o undefined mentre si caricano. */
  summary: SidebarSummary | undefined;
  loading: boolean;
  /** Importi nascosti dall'utente. */
  hidden: boolean;
  onToggleHidden: () => void;
  /** Sidebar compressa: mostra il solo chip di variazione. */
  collapsed: boolean;
  /** Chiamata quando si segue un link (chiude il drawer mobile). */
  onNavigate?: () => void;
  /** Base degli indirizzi dei titoli. */
  titlesHref?: string;
  /** Pagina che elenca tutti i titoli (posizioni e seguiti): il Portafoglio di Investimenti. */
  titlesListHref?: string;
}

const SECTION_LINK_CLASS = "block rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline";

function PrivacyToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostra gli importi" : "Nascondi gli importi"}
      title={hidden ? "Mostra gli importi" : "Nascondi gli importi"}
      className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function ChangeChip({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal tabular-nums",
        value < 0 ? "bg-neg-soft" : "bg-pos-soft",
        changeToneClass(value)
      )}
    >
      {formatSignedPct(value)}
    </span>
  );
}

export function SidebarInsights({
  summary,
  loading,
  hidden,
  onToggleHidden,
  collapsed,
  onNavigate,
  titlesHref = "/investimenti/titoli",
  titlesListHref = "/investimenti",
}: SidebarInsightsProps) {
  const [pensionIncluded] = usePensionInNetWorth();
  if (loading) {
    return collapsed ? null : (
      <div className="mt-2 flex flex-col gap-2 border-t border-sidebar-border pt-3" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded bg-sidebar-accent" />
        <div className="h-16 animate-pulse rounded-lg bg-sidebar-accent" />
      </div>
    );
  }
  if (!summary) return null;
  const { currency, netWorth, portfolio, watchlist } = summary;
  if (!netWorth && !portfolio && watchlist.length === 0) return null;

  if (collapsed) {
    if (!portfolio) return null;
    const total = formatSidebarAmount(portfolio.totalValue, currency, hidden);
    return (
      <Link
        href="/investimenti"
        onClick={onNavigate}
        title={`Portafoglio ${total}${portfolio.dayChangePct !== null ? `, oggi ${formatSignedPct(portfolio.dayChangePct)}` : ""}`}
        className="mx-auto mt-3 flex w-12 flex-col items-center rounded-lg bg-sidebar-accent/60 py-1.5 text-[10px] leading-tight hover:bg-sidebar-accent"
      >
        <span className={cn("font-semibold tabular-nums", changeToneClass(portfolio.dayChangePct))}>
          {portfolio.dayChangePct === null ? "—" : formatSignedPct(portfolio.dayChangePct)}
        </span>
        <span className="text-sidebar-foreground/60">oggi</span>
      </Link>
    );
  }

  // La previdenza è dentro `total` e `monthChange`: se l'utente la esclude dal patrimonio la togliamo qui.
  const dropPension = !pensionIncluded && netWorth?.pension;
  const netWorthTotal = netWorth ? netWorth.total - (dropPension ? netWorth.pension!.total : 0) : 0;
  const netWorthChange =
    netWorth && netWorth.monthChange !== null
      ? netWorth.monthChange - (dropPension ? (netWorth.pension!.monthChange ?? 0) : 0)
      : null;
  const eyeInFirstSection = netWorth ? "oggi" : portfolio ? "portafoglio" : "watchlist";
  const eye = (owner: string) =>
    owner === eyeInFirstSection ? <PrivacyToggle hidden={hidden} onToggle={onToggleHidden} /> : undefined;
  const watchAlerts = watchlist.reduce((sum, w) => sum + w.triggeredAlerts, 0);

  return (
    <div className="mt-2 flex flex-col gap-1">
      {netWorth ? (
        <CollapsibleSection
          id="oggi"
          title="Oggi"
          summary={formatSidebarAmount(netWorthTotal, currency, hidden)}
          action={eye("oggi")}
        >
          <div className="px-1.5 pb-1">
            <p className="font-heading text-xl font-semibold tabular-nums text-sidebar-foreground">
              {formatSidebarAmount(netWorthTotal, currency, hidden)}
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">
              Patrimonio netto
              {netWorthChange !== null ? (
                <>
                  {" · "}
                  <span className={cn("font-medium", changeToneClass(netWorthChange))}>
                    {formatSidebarSignedAmount(netWorthChange, currency, hidden)}
                  </span>{" "}
                  in 30 giorni
                </>
              ) : null}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {portfolio ? (
        <CollapsibleSection
          id="portafoglio"
          title="Portafoglio"
          summary={formatSidebarAmount(portfolio.totalValue, currency, hidden)}
          badge={<ChangeChip value={portfolio.dayChangePct} />}
          action={eye("portafoglio")}
        >
          <div className="px-1.5 pb-1">
            <p className="font-heading text-xl font-semibold tabular-nums text-sidebar-foreground">
              {formatSidebarAmount(portfolio.totalValue, currency, hidden)}
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">
              <span className={cn("font-medium", changeToneClass(portfolio.totalGain))}>
                {formatSidebarSignedAmount(portfolio.totalGain, currency, hidden)}
              </span>
              {portfolio.totalGainPct !== null ? ` · ${formatSignedPct(portfolio.totalGainPct)} in totale` : ""}
            </p>
          </div>
          <div className="mt-1 flex flex-col">
            {portfolio.holdings.slice(0, MAX_HOLDINGS_SHOWN).map((h) => (
              <InsightRow
                key={h.instrumentId}
                href={`${titlesHref}/${h.instrumentId}`}
                label={h.label}
                name={h.name}
                valueText={h.value === null ? "—" : formatSidebarAmount(h.value, currency, hidden)}
                changePct={h.dayChangePct}
                spark={h.spark}
                alert={h.triggeredAlerts > 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
          {portfolio.holdings.length > MAX_HOLDINGS_SHOWN ? (
            <Link href={titlesListHref} onClick={onNavigate} className={SECTION_LINK_CLASS}>
              Mostra tutti ({portfolio.holdings.length}) →
            </Link>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {watchlist.length > 0 ? (
        <CollapsibleSection
          id="watchlist"
          title="Watchlist"
          defaultOpen={false}
          summary={`${watchlist.length} ${watchlist.length === 1 ? "titolo" : "titoli"}`}
          badge={
            watchAlerts > 0 ? (
              <span className="rounded-full bg-neg-soft px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neg">
                {watchAlerts} {watchAlerts === 1 ? "avviso" : "avvisi"}
              </span>
            ) : undefined
          }
          action={eye("watchlist")}
        >
          <div className="flex flex-col">
            {watchlist.slice(0, MAX_WATCHLIST_SHOWN).map((w) => (
              <InsightRow
                key={w.instrumentId}
                href={`${titlesHref}/${w.instrumentId}`}
                label={w.label}
                name={w.name}
                valueText={w.lastClose === null ? "—" : formatSidebarPrice(w.lastClose, w.currency, hidden)}
                changePct={w.dayChangePct}
                spark={w.spark}
                alert={w.triggeredAlerts > 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
          {watchlist.length > MAX_WATCHLIST_SHOWN ? (
            <Link href={titlesListHref} onClick={onNavigate} className={SECTION_LINK_CLASS}>
              Mostra tutti ({watchlist.length}) →
            </Link>
          ) : null}
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
