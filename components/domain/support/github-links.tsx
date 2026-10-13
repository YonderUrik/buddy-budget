"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Collegamenti al repository open source: segnalare su GitHub, vedere cosa è già aperto, novità e sicurezza. */

import { ExternalLink } from "lucide-react";
import { GithubIcon } from "./github-icon";
import { track } from "@/lib/analytics";
import { REPO_URL, githubIssueUrl, type ReportContext } from "@/lib/support";

type LinkId = "issue" | "issue_aperte" | "novita" | "sicurezza";

interface HelpLink {
  id: LinkId;
  label: string;
  hint: string;
  href: string;
}

export interface GithubLinksProps {
  context: ReportContext;
}

export function GithubLinks({ context }: GithubLinksProps) {
  const { t: tr } = useLocalization();
  const links: HelpLink[] = [
    { id: "issue", label: tr("Apri una issue su GitHub"), hint: tr("Pubblica: per problemi e idee senza dati personali."), href: githubIssueUrl("problema", context) },
    { id: "issue_aperte", label: tr("Vedi le segnalazioni aperte"), hint: tr("Controlla se qualcuno ha già scritto la stessa cosa."), href: `${REPO_URL}/issues` },
    { id: "novita", label: tr("Novità e correzioni"), hint: tr("Cosa è cambiato in ogni versione."), href: `${REPO_URL}/releases` },
    { id: "sicurezza", label: tr("Segnala una vulnerabilità"), hint: tr("In privato, mai in una issue pubblica."), href: `${REPO_URL}/security/policy` },
  ];
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {links.map((link) => (
        <li key={link.id}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("support_link_opened", { link: link.id })}
            className="group flex min-h-11 flex-col justify-center rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:underline">
              {link.id === "issue" && <GithubIcon className="size-4" />}
              {tr(link.label)}
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">{tr("(si apre in una nuova scheda)")}</span>
            </span>
            <span className="text-xs text-muted-foreground">{tr(link.hint)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
