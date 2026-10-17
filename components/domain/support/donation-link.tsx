"use client";
import { useLocalization } from "@/lib/localization/provider";

/** «Offrimi un caffè» link to the Buy Me a Coffee page, with a one-line reason; tracks the click as `donation_link_opened`. */

import { Coffee, ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";
import { DONATION_URL } from "@/lib/support";

export interface DonationLinkProps {
  /** Where the link is shown, for the product event. */
  source?: "aiuto" | "menu_utente" | "menu_altro";
}

export function DonationLink({ source = "aiuto" }: DonationLinkProps) {
  const { t: tr } = useLocalization();
  return (
    <a
      href={DONATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("donation_link_opened", { source })}
      className="group flex min-h-11 flex-col justify-center rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:underline">
        <Coffee className="size-4" aria-hidden="true" />
        {tr("Offrimi un caffè")}
        <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{tr("(si apre in una nuova scheda)")}</span>
      </span>
      <span className="text-xs text-muted-foreground">{tr("Su Buy Me a Coffee, una tantum o ogni mese. L'app resta gratuita e open source.")}</span>
    </a>
  );
}
