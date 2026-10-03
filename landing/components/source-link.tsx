"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export interface SourceLinkProps {
  href: string;
  children: ReactNode;
}

/** Link al repository del codice; invia `source_link_click` a Umami al click. */
export function SourceLink({ href, children }: SourceLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track("source_link_click", { location: "footer" })}>
      {children}
    </a>
  );
}
