"use client";

import Link from "next/link";
import { track, type LandingEvents } from "@/lib/analytics";

/** Destinations of the back link, as the categorical prop of `back_link_click`. */
const TARGETS: Record<string, LandingEvents["back_link_click"]["to"]> = { "/": "home", "/en": "home", "/strumenti": "strumenti", "/en/calculators": "strumenti", "/funzioni": "funzioni", "/en/features": "funzioni" };

/** «‹ Pagina madre» above the title of the internal pages, the same as in the app; sends `back_link_click`. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="back-link" onClick={() => track("back_link_click", { to: TARGETS[href] ?? "altro" })}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
