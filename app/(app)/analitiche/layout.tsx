"use client";

/** Layout di Analitiche: intestazione, ipotesi (con riepilogo sempre visibile), guida iniziale e le quattro domande. */

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { AssumptionsPanel, WalkthroughDialog, money, pct } from "@/components/domain/analytics";
import { CollapsibleSection, LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { AnalyticsProvider, useAnalytics } from "@/lib/analitiche/analytics-context";

const DISCLAIMER =
  "Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.";

/** Riga di riepilogo delle ipotesi, visibile anche a sezione chiusa: i numeri su cui poggia tutto il resto. */
function assumptionsSummary(plan: AnalyticsPlan, a: AnalyticsAssumptions, currency: string): string {
  const parts = [
    plan.spending !== null ? `spesa ${money(plan.spending, currency)}` : null,
    plan.savings !== null ? `risparmio ${money(plan.savings, currency)}` : null,
    `rendimento ${pct(a.expectedReturn)}`,
    `prelievo ${pct(a.withdrawalRate)}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

function Header({ onGuide }: { onGuide?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Analitiche</h1>
        <p className="text-sm text-muted-foreground">Quattro domande, una risposta ciascuna. I numeri tecnici sono in «Per esperti».</p>
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
  const ctx = useAnalytics();
  const [guideOpen, setGuideOpen] = React.useState(false);
  const autoOpened = React.useRef(false);

  React.useEffect(() => {
    track("analytics_page_viewed");
  }, []);

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
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-3">
        <Header
          onGuide={() => {
            track("analytics_guide_reopened");
            setGuideOpen(true);
          }}
        />
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
          <CollapsibleSection
            id="analytics-assumptions"
            title="Le tue ipotesi"
            defaultOpen={false}
            summary={assumptionsSummary(ctx.plan, ctx.assumptions, ctx.base.currency)}
          >
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
  return (
    <AnalyticsProvider>
      <AnalyticsShell>{children}</AnalyticsShell>
    </AnalyticsProvider>
  );
}
