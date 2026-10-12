"use client";

import type * as React from "react";
import { AppShell, type NavBadge } from "@/components/layout";
import { useQuickReport } from "@/components/domain/support";
import { formatBadgeCount } from "@/lib/attention";
import { useAttentionQuery } from "@/lib/queries/attention";

/** Voce di navigazione che mostra il badge dei movimenti da sistemare. */
const ATTENTION_PARENT_HREF = "/liquidita";

/**
 * AppShell con il badge accanto a Liquidità e il pulsante «Scrivici». Il badge conta i movimenti da decidere (ancora «Da
 * categorizzare»), lo stesso numero di «Da decidere» in Movimenti e di «Da decidere» in Categorizza: i movimenti nuovi
 * già categorizzati da soli non chiedono niente e restano fuori.
 */
export function AttentionShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const { data } = useAttentionQuery();
  const openReport = useQuickReport();
  const count = data?.uncategorizedCount ?? 0;
  const navBadges: Record<string, NavBadge> = {
    [ATTENTION_PARENT_HREF]: {
      count,
      countLabel: formatBadgeCount(count),
      ariaLabel: `${count} da decidere`,
    },
  };
  return (
    <AppShell sidebarExtra={sidebarExtra} navBadges={navBadges} onOpenSupport={() => openReport({ source: "pulsante" })}>
      {children}
    </AppShell>
  );
}
