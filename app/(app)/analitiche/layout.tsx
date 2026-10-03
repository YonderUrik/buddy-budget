"use client";

/** Layout di Analitiche: accesso solo con gli strumenti avanzati accesi, ipotesi, guida iniziale e schede. */

import * as React from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { ANALYTICS_TABS, AnalyticsGate, AssumptionsPanel, WalkthroughDialog } from "@/components/domain/analytics";
import { CollapsibleSection, LoadError, SectionTabs } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { AnalyticsProvider, useAnalytics } from "@/lib/analitiche/analytics-context";
import { useUserSettingsQuery } from "@/lib/queries/user-settings";

const TAB_EVENT_NAMES = {
  "/analitiche": "fire",
  "/analitiche/simulazione": "simulazione",
  "/analitiche/prelievi": "prelievi",
  "/analitiche/crescita": "crescita",
  "/analitiche/rischio": "rischio",
  "/analitiche/costi": "costi",
} as const;

const DISCLAIMER =
  "Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.";

function Header({ onGuide }: { onGuide?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Analitiche</h1>
        <p className="text-sm text-muted-foreground">Obiettivo FIRE, simulazioni, rischio e costi: per chi vuole capire i numeri a fondo</p>
      </div>
      {onGuide ? (
        <Button variant="outline" size="sm" onClick={onGuide}>
          <HelpCircle className="size-4" aria-hidden="true" />
          Guida
        </Button>
      ) : null}
    </div>
  );
}

function AnalyticsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ctx = useAnalytics();
  const [guideOpen, setGuideOpen] = React.useState(false);
  const autoOpened = React.useRef(false);

  React.useEffect(() => {
    const tab = TAB_EVENT_NAMES[pathname as keyof typeof TAB_EVENT_NAMES];
    if (tab) track("analytics_tab_viewed", { tab });
  }, [pathname]);

  const ready = !ctx.isLoading && !ctx.isError && ctx.base && ctx.assumptions && ctx.plan;
  React.useEffect(() => {
    if (ready && !ctx.walkthroughSeen && !autoOpened.current) {
      autoOpened.current = true;
      setGuideOpen(true);
    }
  }, [ready, ctx.walkthroughSeen]);

  const closeGuide = (step: number, outcome: "completata" | "chiusa") => {
    setGuideOpen(false);
    track("analytics_guide_closed", { step, outcome });
    if (!ctx.walkthroughSeen) ctx.markWalkthroughSeen();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-3">
        <Header
          onGuide={() => {
            track("analytics_guide_reopened");
            setGuideOpen(true);
          }}
        />
        <SectionTabs tabs={ANALYTICS_TABS} activeHref={pathname} ariaLabel="Sezioni di Analitiche" />
      </div>
      {ctx.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : ctx.isError || !ctx.base || !ctx.assumptions || !ctx.plan ? (
        <LoadError message="Impossibile caricare i dati di Analitiche." onRetry={ctx.refetch} />
      ) : (
        <>
          <CollapsibleSection id="analytics-assumptions" title="Le tue ipotesi" defaultOpen={false}>
            <AssumptionsPanel
              // Si rimonta quando le ipotesi salvate cambiano da fuori, per non mostrare bozze vecchie.
              key={JSON.stringify(ctx.assumptions)}
              assumptions={ctx.assumptions}
              plan={ctx.plan}
              currency={ctx.base.currency}
              pensionValue={ctx.base.wealth.pension}
              saving={ctx.saving}
              error={ctx.saveError}
              onSave={ctx.saveAssumptions}
            />
          </CollapsibleSection>
          {children}
          <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
        </>
      )}
      <WalkthroughDialog open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

export default function AnalitricheLayout({ children }: { children: React.ReactNode }) {
  const settings = useUserSettingsQuery();
  if (settings.isLoading) return <div className="mx-auto max-w-4xl p-4 sm:p-6" aria-busy="true"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  if (!settings.data?.advancedAnalytics) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
        <Header />
        <AnalyticsGate />
      </div>
    );
  }
  return (
    <AnalyticsProvider>
      <AnalyticsShell>{children}</AnalyticsShell>
    </AnalyticsProvider>
  );
}
