"use client";

/** Pagina «Aiuto e segnalazioni»: risposte rapide, form per scriverci e collegamenti a GitHub. Stile Panoramica: sezioni aperte con icona. */

import { HelpCircle, MessageSquare } from "lucide-react";
import { GithubIcon } from "./github-icon";
import { FaqList } from "./faq-list";
import { GithubLinks } from "./github-links";
import { ReportForm } from "./report-form";
import { useReportContext } from "./use-report-context";
import { track } from "@/lib/analytics";
import { REPORT_KINDS, STATUS_URL, type ReportKind } from "@/lib/support";

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 id={id} className="font-heading text-lg font-medium text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
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
  const context = useReportContext(from);
  const initialKind = (REPORT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ReportKind) : undefined;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:gap-10 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Aiuto e segnalazioni</h1>
        <p className="text-sm text-muted-foreground">Puoi scriverci anche da qualsiasi pagina, con l&apos;icona del fumetto, e dai messaggi d&apos;errore.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          L&apos;app è lenta o non risponde? Guarda prima lo{" "}
          <a
            href={STATUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("support_link_opened", { link: "stato" })}
            className="font-medium text-foreground underline underline-offset-2"
          >
            stato del servizio<span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
          .
        </p>
      </div>
      <Section id="aiuto-scrivici" icon={MessageSquare} title="Scrivici" description="Un problema, una domanda o un'idea: ti rispondiamo via email.">
        <ReportForm context={context} initialKind={initialKind} />
      </Section>
      <Section id="aiuto-risposte" icon={HelpCircle} title="Risposte rapide" description="Le domande che riceviamo più spesso.">
        <FaqList />
      </Section>
      <Section id="aiuto-github" icon={GithubIcon} title="Su GitHub" description="BuddyBudget è open source: puoi seguire e segnalare anche da lì.">
        <GithubLinks context={context} />
      </Section>
    </div>
  );
}
