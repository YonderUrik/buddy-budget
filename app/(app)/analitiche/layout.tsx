"use client";
import { PlanningScreen } from "@/components/domain/financial-planning";
import { useLocalization } from "@/lib/localization/provider";

/** Layout di Analitiche: intestazione, guida iniziale e caricamento dei dati; il corpo (cursori e risposte) è la pagina. */

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { WalkthroughDialog } from "@/components/domain/analytics";
import { LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { AnalyticsProvider, useAnalytics } from "@/lib/analitiche/analytics-context";
import { GOAL_PARAM } from "@/lib/start";

const DISCLAIMER =
  "Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.";

function Header({ onGuide }: { onGuide?: () => void }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">{tr("Analitiche")}</h1>
        <p className="text-sm text-muted-foreground">{tr("Muovi le ipotesi e guarda cosa cambia. I numeri tecnici sono in «Per esperti».")}</p>
      </div>
      {onGuide ? (
        <Button variant="outline" size="sm" onClick={onGuide}>
          <HelpCircle className="size-4" aria-hidden="true" />{tr("Guida")}</Button>
      ) : null}
    </div>
  );
}

function AnalyticsShell({ children }: { children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const ctx = useAnalytics();
  const [guideOpen, setGuideOpen] = React.useState(false);
  const autoOpened = React.useRef(false);
  // Chi arriva dai Primi passi trova «Il tuo traguardo»: la guida non gli si apre sopra (resta da vedere dal pulsante).
  const fromGoalLink = React.useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).has(GOAL_PARAM));

  React.useEffect(() => {
    track("analytics_page_viewed");
  }, []);

  const ready = !ctx.isLoading && !ctx.isError && ctx.base && ctx.assumptions && ctx.plan;
  React.useEffect(() => {
    if (ready && !ctx.walkthroughSeen && !autoOpened.current && !fromGoalLink.current) {
      autoOpened.current = true;
      setGuideOpen(true);
    }
  }, [ready, ctx.walkthroughSeen]);

  // Da dove vengono rendimento, spesa e risparmio mostrati: dice quanti utenti hanno abbastanza dati per i valori automatici.
  const sourceShown = React.useRef(false);
  const returnInfo = ready ? ctx.returnInfo : null;
  const plan = ready ? ctx.plan : null;
  const period = ready ? ctx.assumptions?.dataPeriod : undefined;
  React.useEffect(() => {
    if (!returnInfo || !plan || !period || sourceShown.current) return;
    sourceShown.current = true;
    const { source, history } = returnInfo;
    const historySource = period.kind === "personalizzato" ? "storico-personalizzato" : period.months === 24 ? "storico-24" : "storico-12";
    track("analytics_return_source_shown", { source: source === "storico" && history.status === "ok" ? historySource : source === "storico" ? "prudente" : source });
    track("analytics_cashflow_source_shown", { spending: plan.spendingSource, savings: plan.savingsSource });
  }, [returnInfo, plan, period]);

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
          {children}
          <p className="text-xs text-muted-foreground">{tr(DISCLAIMER)}</p>
        </>
      )}
      <WalkthroughDialog open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

export default function AnalitricheLayout({ children }: { children: React.ReactNode }) {
  const { productCountry } = useLocalization();
  if (productCountry === "DE") return <PlanningScreen section="retirement" />;
  return (
    <AnalyticsProvider>
      <AnalyticsShell>{children}</AnalyticsShell>
    </AnalyticsProvider>
  );
}
