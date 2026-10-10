"use client";

/** Pagina «Aiuto e segnalazioni»: risposte rapide, form per scriverci e collegamenti a GitHub. Stile Panoramica: sezioni aperte con icona. */

import { HelpCircle, GitBranch, MessageSquare } from "lucide-react";
import { FaqList } from "./faq-list";
import { GithubLinks } from "./github-links";
import { ReportForm } from "./report-form";
import { useReportContext } from "./use-report-context";
import { REPORT_KINDS, type ReportKind } from "@/lib/support";

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: typeof HelpCircle; title: string; description: string; children: React.ReactNode }) {
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
        <p className="text-sm text-muted-foreground">Trova una risposta o scrivici: leggiamo tutto.</p>
      </div>
      <Section id="aiuto-risposte" icon={HelpCircle} title="Risposte rapide" description="Le domande che riceviamo più spesso.">
        <FaqList />
      </Section>
      <Section id="aiuto-scrivici" icon={MessageSquare} title="Scrivici" description="Non hai trovato quello che cerchi? Ti rispondiamo via email.">
        <ReportForm context={context} initialKind={initialKind} />
      </Section>
      <Section id="aiuto-github" icon={GitBranch} title="Su GitHub" description="BuddyBudget è open source: puoi seguire e segnalare anche da lì.">
        <GithubLinks context={context} />
      </Section>
    </div>
  );
}
