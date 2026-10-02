"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { track } from "@/lib/analytics";
import { LANDING_URL } from "@/lib/legal";

export interface BrandLinkProps {
  /** Nome del brand mostrato accanto al marchio. */
  name: string;
  /** Destinazione; di default la landing. */
  href?: string;
  /** Classi del contenitore (colore e dimensione del testo). */
  className?: string;
  /** Classi dell'immagine del marchio. */
  markClassName?: string;
  /** Mostra anche il link discreto "Torna al sito". */
  showBackLink?: boolean;
}

const BACK_LINK_LABEL = "Torna al sito";

/** Logo con nome che porta alla landing, più (opzionale) un link "Torna al sito"; ogni clic invia `landing_link_clicked`. */
export function BrandLink({ name, href = LANDING_URL, className, markClassName = "h-8 w-auto", showBackLink = false }: BrandLinkProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <a
        href={href}
        aria-label={`${name}: torna al sito`}
        onClick={() => track("landing_link_clicked", { from: "logo" })}
        className={`flex items-center gap-2.5 rounded-md font-heading font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
      >
        <Image src="/brand/logo-mark.svg" alt="" width={24} height={29} className={markClassName} aria-hidden="true" />
        {name}
      </a>
      {showBackLink && (
        <a
          href={href}
          onClick={() => track("landing_link_clicked", { from: "back_link" })}
          className="flex items-center gap-1 rounded-md text-xs text-text-3 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {BACK_LINK_LABEL}
        </a>
      )}
    </div>
  );
}
