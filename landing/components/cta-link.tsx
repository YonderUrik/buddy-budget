"use client";

import { useRef, type ReactNode } from "react";
import { track, type LandingEvents } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import { gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";

/** How much (0-1) the button follows the cursor. */
const MAGNET_PULL = 0.28;

interface CtaLinkBase {
  href: string;
  className?: string;
  location: LandingEvents["cta_click"]["location"];
  /** Language of the page, sent with the event. */
  lang?: Locale;
  /** Adds the arrow after the text (main buttons). */
  arrow?: boolean;
  children: ReactNode;
}

/** A button towards the app (`cta_click` with its destination) or towards the public demo (`demo_click`). */
export type CtaLinkProps = CtaLinkBase & ({ target: LandingEvents["cta_click"]["target"]; demo?: never } | { demo: true; target?: never });

/** Link that sends `cta_click` (or `demo_click` with `demo`) to Umami on click: categorical position, destination and language only. */
export function CtaLink({ href, className, location, target, demo, lang = "it", arrow = false, children }: CtaLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  // The main buttons are slightly magnetic: they follow the cursor up close and go back in place on leave.
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !className?.includes("main")) return;
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (hover: hover)`, () => {
        const moveX = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
        const moveY = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          moveX((e.clientX - (r.left + r.width / 2)) * MAGNET_PULL);
          moveY((e.clientY - (r.top + r.height / 2)) * MAGNET_PULL);
        };
        const onLeave = () => {
          moveX(0);
          moveY(0);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        };
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <a ref={ref} href={href} className={className} onClick={() => (demo ? track("demo_click", { location, lang }) : track("cta_click", { location, target: target!, lang }))}>
      {children}
      {arrow && <ArrowIcon />}
    </a>
  );
}

/** Arrow on the right of the main buttons. */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
