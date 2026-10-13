"use client";

import type { ReactNode } from "react";
import { track, type LandingEvents } from "@/lib/analytics";

/**
 * Card di una banca o di un broker in «Funziona con»: chi la tocca vuole iniziare da lì (test con utenti del
 * 2026-10-13), quindi porta all'accesso e invia `source_card_click`.
 */
export function SourceCardLink({ href, kind, className, label, children }: { href: string; kind: LandingEvents["source_card_click"]["kind"]; className?: string; label: string; children: ReactNode }) {
  return (
    <a href={href} className={className} aria-label={label} onClick={() => track("source_card_click", { kind })}>
      {children}
    </a>
  );
}
