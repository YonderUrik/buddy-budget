"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export interface SocialLinkProps {
  href: string;
  /** Which profile it opens (for `social_link_click`). */
  network: "instagram";
  children: ReactNode;
  className?: string;
}

/** Link to one of the brand's social profiles, in a new tab; sends `social_link_click` to Umami on click. */
export function SocialLink({ href, network, children, className }: SocialLinkProps) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={() => track("social_link_click", { network, location: "footer" })}>
      {children}
    </a>
  );
}
