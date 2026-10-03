"use client";

import type * as React from "react";
import { AppShell, type NavSubItem } from "@/components/layout";
import { formatBadgeCount } from "@/lib/attention";
import { track } from "@/lib/analytics";
import { useAttentionQuery } from "@/lib/queries/attention";
import { useUserSettingsQuery } from "@/lib/queries/user-settings";

/** Voce padre sotto cui compare "Da sistemare" e schermata a cui porta. */
const ATTENTION_PARENT_HREF = "/movimenti";
const ATTENTION_TARGET_HREF = "/categorizza";
const ATTENTION_LABEL = "Da sistemare";

/** AppShell con la sottovoce "Da sistemare" (transazioni nuove o da categorizzare) sotto Movimenti. */
export function AttentionShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const { data } = useAttentionQuery();
  const { data: settings } = useUserSettingsQuery();
  const count = data?.totalCount ?? 0;
  const navSubItems: Record<string, NavSubItem> = {
    [ATTENTION_PARENT_HREF]: {
      label: ATTENTION_LABEL,
      href: ATTENTION_TARGET_HREF,
      count,
      countLabel: formatBadgeCount(count),
      onClick: () => track("attention_link_clicked", { from: "sidebar" }),
    },
  };
  return (
    <AppShell sidebarExtra={sidebarExtra} navSubItems={navSubItems} showAdvanced={settings?.advancedAnalytics === true}>
      {children}
    </AppShell>
  );
}
