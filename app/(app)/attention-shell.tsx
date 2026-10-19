"use client";

import type * as React from "react";
import { useMemo } from "react";
import { AppShell } from "@/components/layout";
import { useQuickReport } from "@/components/domain/support";
import { PageBackBar, TopBarBack } from "@/components/domain/shared";
import { planNavLocks } from "./plan-locks";

/** «‹» back button in the phone top bar, in place of the brand when there is somewhere to go back to. */
const renderTopBarBack = (fallback: React.ReactNode) => <TopBarBack fallback={fallback} />;

/**
 * AppShell with the «Scrivici» button and the app-wide «‹» back button (top bar on the phone, above the page on desktop).
 * On the Free plan (`planLocked`) the Pro sections are locked in the menu and lead to the plans page.
 * Liquidità has no count badge in the navigation: transactions to decide are shown inside the section («Da decidere»).
 */
export function AttentionShell({ children, sidebarExtra, planLocked = false }: { children: React.ReactNode; sidebarExtra?: React.ReactNode; planLocked?: boolean }) {
  const openReport = useQuickReport();
  const navLocks = useMemo(() => (planLocked ? planNavLocks() : undefined), [planLocked]);
  return (
    <AppShell
      sidebarExtra={sidebarExtra}
      onOpenSupport={() => openReport({ source: "pulsante" })}
      topbarLeading={renderTopBarBack}
      contentHeader={<PageBackBar />}
      navLocks={navLocks}
    >
      {children}
    </AppShell>
  );
}
