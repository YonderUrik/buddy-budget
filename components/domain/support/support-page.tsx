"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Pagina «Aiuto e segnalazioni»: risposte rapide, form per scriverci e collegamenti a GitHub. Stile Panoramica: sezioni aperte con icona. */

import { HelpCircle, MessageSquare } from "lucide-react";
import { GithubIcon } from "./github-icon";
import { FaqList } from "./faq-list";
import { GithubLinks } from "./github-links";
import { ReportForm } from "./report-form";
import { useReportContext } from "./use-report-context";
import { track } from "@/lib/analytics";
import { REPORT_KINDS, STATUS_URL, type ReportKind } from "@/lib/support";
import { PAGE_TITLE } from "@/components/domain/shared";

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 id={id} className="font-heading text-lg font-medium text-foreground">{tr(title)}</h2>
          <p className="text-sm text-muted-foreground">{tr(description)}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export interface SupportPageProps {
  /** Pagina da cui l'utente è arrivato (`?da=`), allegata come contesto. */
  from?: string | null;
  /** Tipo di segnalazione preselezionato (`?tipo=`). */
  kind?: string | null;
}

export function SupportPage({ from = null, kind = null }: SupportPageProps) {
  const { t: tr } = useLocalization();
  const context = useReportContext(from);
  const initialKind = (REPORT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ReportKind) : undefined;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:gap-10 sm:p-6">
      <div>
        <h1 className={PAGE_TITLE}>{tr("Aiuto e segnalazioni")}</h1>
        <p className="text-sm text-muted-foreground">{tr("Puoi scriverci anche da qualsiasi pagina, con l'icona del fumetto, e dai messaggi d'errore.")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("L'app è lenta o non risponde? Guarda prima lo")}{" "}
          <a
            href={STATUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("support_link_opened", { link: "stato" })}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {tr("stato del servizio")}<span className="sr-only"> {tr("(si apre in una nuova scheda)")}</span>
          </a>
          {"."}</p>
      </div>
      <Section id="aiuto-scrivici" icon={MessageSquare} title={tr("Scrivici")} description={tr("Un problema, una domanda o un'idea: ti rispondiamo via email.")}>
        <ReportForm context={context} initialKind={initialKind} />
      </Section>
      <Section id="aiuto-risposte" icon={HelpCircle} title={tr("Risposte rapide")} description={tr("Le domande che riceviamo più spesso.")}>
        <FaqList />
      </Section>
      <Section id="aiuto-github" icon={GithubIcon} title={tr("Su GitHub")} description={tr("BuddyBudget è open source: puoi seguire e segnalare anche da lì.")}>
        <GithubLinks context={context} />
      </Section>
    </div>
  );
}
