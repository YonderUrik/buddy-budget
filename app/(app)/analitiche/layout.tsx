"use client";
import { PlanningScreen } from "@/components/domain/financial-planning";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Layout di Analitiche: due viste, Risposte (cursori e risposte, con guida iniziale e i dati delle Analitiche) e
 * Obiettivi (che chiedono i propri dati al server). Il dettaglio di un obiettivo ha solo il ritorno alla lista.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Plus } from "lucide-react";
import { ANALYTICS_TABS, GOALS_BASE_PATH, WalkthroughDialog } from "@/components/domain/analytics";
import { LoadError, SectionHeading, SectionTabs } from "@/components/domain/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { AnalyticsProvider, useAnalytics } from "@/lib/analitiche/analytics-context";
import { GOAL_PARAM } from "@/lib/start";

const DISCLAIMER =
  "Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.";

/** Indirizzo che apre il form «Nuovo obiettivo» nella vista Obiettivi. */
const NEW_GOAL_HREF = `${GOALS_BASE_PATH}?nuovo=1`;

function Header({ action }: { action?: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const goals = pathname.startsWith(GOALS_BASE_PATH);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading
          title={tr("Analitiche")}
          subtitle={goals ? tr("Per cosa metti da parte, quando ci arrivi e cosa cambia per il traguardo.") : tr("Muovi le ipotesi e guarda cosa cambia. I numeri tecnici sono in «Per esperti».")}
          subtitleClassName="text-sm text-muted-foreground"
          tabs={ANALYTICS_TABS}
          activeHref={pathname}
          analyticsKey="analitiche"
        />
        {action}
      </div>
      <SectionTabs tabs={ANALYTICS_TABS} activeHref={pathname} ariaLabel={tr("Viste di Analitiche")} />
    </div>
  );
}

/** Vista Obiettivi: testata con «Nuovo obiettivo»; il dettaglio di un obiettivo ha la sua testata. */
function GoalsShell({ children }: { children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const detail = pathname.length > GOALS_BASE_PATH.length + 1;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      {detail ? null : (
        <Header
          action={
            <Link href={NEW_GOAL_HREF} scroll={false} className={cn(buttonVariants({ variant: "sun" }), "h-11 shrink-0 sm:h-9")}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="max-sm:sr-only">{tr("Nuovo obiettivo")}</span>
            </Link>
          }
        />
      )}
      {children}
      <p className="text-xs text-muted-foreground">{tr(DISCLAIMER)}</p>
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
      <Header
        action={
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              track("analytics_guide_reopened");
              setGuideOpen(true);
            }}
          >
            <HelpCircle className="size-4" aria-hidden="true" />
            {tr("Guida")}
          </Button>
        }
      />
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
  const pathname = usePathname();
  if (productCountry === "DE") return <PlanningScreen section="retirement" />;
  // Gli Obiettivi chiedono i propri dati (il piano è calcolato sul server): niente richieste delle Risposte.
  if (pathname.startsWith(GOALS_BASE_PATH)) return <GoalsShell>{children}</GoalsShell>;
  return (
    <AnalyticsProvider>
      <AnalyticsShell>{children}</AnalyticsShell>
    </AnalyticsProvider>
  );
}
