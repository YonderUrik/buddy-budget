"use client";

import type * as React from "react";
import { AppShell, type NavBadge } from "@/components/layout";
import { formatBadgeCount } from "@/lib/attention";
import { useAttentionQuery } from "@/lib/queries/attention";

/** Voce di navigazione che mostra il badge dei movimenti da sistemare. */
const ATTENTION_PARENT_HREF = "/movimenti";

/** AppShell con il badge dei movimenti da sistemare (nuovi o da categorizzare) accanto a Movimenti. */
export function AttentionShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const { data } = useAttentionQuery();
  const count = data?.totalCount ?? 0;
  const navBadges: Record<string, NavBadge> = {
    [ATTENTION_PARENT_HREF]: {
      count,
      countLabel: formatBadgeCount(count),
      ariaLabel: `${count} da sistemare`,
    },
  };
  return (
    <AppShell sidebarExtra={sidebarExtra} navBadges={navBadges}>
      {children}
    </AppShell>
  );
}
