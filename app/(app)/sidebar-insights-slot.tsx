"use client";

/**
 * Collega il riepilogo della sidebar ai dati: legge il riepilogo dal server, ricorda se l'utente ha nascosto gli
 * importi e prende dallo slot lo stato della sidebar (compressa, drawer mobile).
 */

import { SidebarInsights } from "@/components/domain/sidebar-insights";
import { useSidebarSlot } from "@/components/layout";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { useSidebarSummaryQuery } from "@/lib/queries/sidebar";

/** Chiave del flag "nascondi importi": vale per tutta la sidebar e resta tra le visite. */
const HIDE_VALUES_KEY = "sidebar-hide-values";

export function SidebarInsightsSlot() {
  const { collapsed, onNavigate } = useSidebarSlot();
  const query = useSidebarSummaryQuery();
  const [hidden, setHidden] = usePersistedFlag(HIDE_VALUES_KEY, false);
  return (
    <SidebarInsights
      summary={query.data}
      loading={query.isLoading}
      hidden={hidden}
      onToggleHidden={() => setHidden(!hidden)}
      collapsed={collapsed}
      onNavigate={onNavigate}
    />
  );
}
