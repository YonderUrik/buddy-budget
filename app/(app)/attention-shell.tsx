"use client";

import * as React from "react";
import { AppShell, type ShellAction } from "@/components/layout";
import { useQuickReport } from "@/components/domain/support";
import { useQuickAdd } from "@/components/domain/quick-add";
import { Plus } from "lucide-react";
import { PageBackBar, TopBarBack } from "@/components/domain/shared";

/** «‹» back button in the phone top bar, in place of the brand when there is somewhere to go back to. */
const renderTopBarBack = (fallback: React.ReactNode) => <TopBarBack fallback={fallback} />;

/**
 * AppShell with the «Scrivici» button, the app-wide «Aggiungi» (middle of the bottom bar, top of the sidebar) and the
 * app-wide «‹» back button (top bar on the phone, above the page on desktop).
 * Liquidità has no count badge in the navigation: transactions to decide are shown inside the section («Da decidere»).
 */
export function AttentionShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const openReport = useQuickReport();
  const quickAdd = useQuickAdd();
  const addAction = React.useMemo<ShellAction | undefined>(
    () =>
      quickAdd
        ? {
            label: "Aggiungi",
            icon: Plus,
            onClick: (anchor, origin) => quickAdd.open(origin === "sidebar" ? "sidebar" : "barra", anchor),
          }
        : undefined,
    [quickAdd]
  );
  return (
    <AppShell
      sidebarExtra={sidebarExtra}
      onOpenSupport={() => openReport({ source: "pulsante" })}
      topbarLeading={renderTopBarBack}
      contentHeader={<PageBackBar />}
      addAction={addAction}
    >
      {children}
    </AppShell>
  );
}
