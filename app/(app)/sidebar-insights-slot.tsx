"use client";

/**
 * Collega la zona sotto le voci della sidebar ai dati: riepilogo (patrimonio, portafoglio, watchlist), prossime
 * scadenze e obiettivo FIRE. Ogni modulo si accende o spegne dalle Impostazioni (preferenza per dispositivo) e un
 * modulo spento non fa nessuna richiesta. Legge dalla preferenza globale se gli importi sono nascosti e prende dallo
 * slot lo stato della sidebar (compressa, drawer mobile).
 */

import { SidebarDeadlinesModule, SidebarFireModule, SidebarInsights } from "@/components/domain/sidebar-insights";
import { useSidebarSlot } from "@/components/layout";
import { usePrivacy } from "@/components/privacy-provider";
import { track } from "@/lib/analytics";
import { useSidebarModule } from "@/lib/hooks/use-sidebar-preferences";
import { useSidebarDeadlinesQuery, useSidebarFireQuery, useSidebarSummaryQuery } from "@/lib/queries/sidebar";

export function SidebarInsightsSlot() {
  const { collapsed, onNavigate } = useSidebarSlot();
  const { hidden, toggle } = usePrivacy();
  const [showToday] = useSidebarModule("oggi");
  const [showPortfolio] = useSidebarModule("portafoglio");
  const [showWatchlist] = useSidebarModule("watchlist");
  const [showDeadlines] = useSidebarModule("scadenze");
  const [showFire] = useSidebarModule("fire");
  const summaryNeeded = showToday || showPortfolio || showWatchlist;
  const summary = useSidebarSummaryQuery(summaryNeeded);
  const deadlines = useSidebarDeadlinesQuery(showDeadlines);
  const fire = useSidebarFireQuery(showFire);
  const common = { summary: summary.data, loading: summary.isLoading, hidden, onToggleHidden: toggle, collapsed, onNavigate };
  return (
    <>
      {/* Patrimonio, poi i promemoria brevi (scadenze, FIRE), poi portafoglio e watchlist che sono più lunghi: così i moduli
          nuovi restano visibili anche sui portatili bassi. */}
      {showToday ? <SidebarInsights {...common} show={{ oggi: true, portafoglio: false, watchlist: false }} /> : null}
      {showDeadlines ? (
        <SidebarDeadlinesModule
          data={deadlines.data}
          loading={deadlines.isLoading}
          hidden={hidden}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onItemClick={() => track("sidebar_module_clicked", { module: "scadenze" })}
        />
      ) : null}
      {showFire ? (
        <SidebarFireModule
          data={fire.data}
          loading={fire.isLoading}
          hidden={hidden}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onItemClick={() => track("sidebar_module_clicked", { module: "fire" })}
        />
      ) : null}
      {showPortfolio || showWatchlist ? (
        <SidebarInsights
          {...common}
          show={{ oggi: false, portafoglio: showPortfolio, watchlist: showWatchlist }}
          privacyToggle={!showToday}
        />
      ) : null}
    </>
  );
}
