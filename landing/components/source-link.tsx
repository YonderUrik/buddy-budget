"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export interface SourceLinkProps {
  href: string;
  children: ReactNode;
  /** Dove sta il link (per `source_link_click`). */
  location?: "footer" | "sezione";
  className?: string;
}

/** Link al repository del codice; invia `source_link_click` a Umami al click. */
export function SourceLink({ href, children, location = "footer", className }: SourceLinkProps) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={() => track("source_link_click", { location })}>
      {children}
    </a>
  );
}
