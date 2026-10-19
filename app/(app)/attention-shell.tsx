"use client";

import type * as React from "react";
import { AppShell } from "@/components/layout";
import { useQuickReport } from "@/components/domain/support";
import { PageBackBar, TopBarBack } from "@/components/domain/shared";

/** «‹» back button in the phone top bar, in place of the brand when there is somewhere to go back to. */
const renderTopBarBack = (fallback: React.ReactNode) => <TopBarBack fallback={fallback} />;

/**
 * AppShell with the «Scrivici» button and the app-wide «‹» back button (top bar on the phone, above the page on desktop).
 * Liquidità has no count badge in the navigation: transactions to decide are shown inside the section («Da decidere»).
 */
export function AttentionShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const openReport = useQuickReport();
  return (
    <AppShell
      sidebarExtra={sidebarExtra}
      onOpenSupport={() => openReport({ source: "pulsante" })}
      topbarLeading={renderTopBarBack}
      contentHeader={<PageBackBar />}
    >
      {children}
    </AppShell>
  );
}
