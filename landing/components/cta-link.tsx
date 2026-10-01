"use client";

import type { ReactNode } from "react";
import { track, type LandingEvents } from "@/lib/analytics";

export interface CtaLinkProps {
  href: string;
  className?: string;
  location: LandingEvents["cta_click"]["location"];
  target: LandingEvents["cta_click"]["target"];
  children: ReactNode;
}

/** Link che invia `cta_click` a Umami al click (posizione e destinazione categoriche). */
export function CtaLink({ href, className, location, target, children }: CtaLinkProps) {
  return (
    <a href={href} className={className} onClick={() => track("cta_click", { location, target })}>
      {children}
    </a>
  );
}

export const ARROW_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
