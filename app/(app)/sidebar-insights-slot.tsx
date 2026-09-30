"use client";

/**
 * Collega il riepilogo della sidebar ai dati: legge il riepilogo dal server, legge dalla preferenza globale se gli
 * importi sono nascosti e prende dallo slot lo stato della sidebar (compressa, drawer mobile).
 */

import { SidebarInsights } from "@/components/domain/sidebar-insights";
import { useSidebarSlot } from "@/components/layout";
import { usePrivacy } from "@/components/privacy-provider";
import { useSidebarSummaryQuery } from "@/lib/queries/sidebar";

export function SidebarInsightsSlot() {
  const { collapsed, onNavigate } = useSidebarSlot();
  const query = useSidebarSummaryQuery();
  const { hidden, toggle } = usePrivacy();
  return (
    <SidebarInsights
      summary={query.data}
      loading={query.isLoading}
      hidden={hidden}
      onToggleHidden={toggle}
      collapsed={collapsed}
      onNavigate={onNavigate}
    />
  );
}
