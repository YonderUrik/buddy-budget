"use client";

import { useRef, type ReactNode } from "react";
import { track, type LandingEvents } from "@/lib/analytics";
import { gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";

/** Quanto (0-1) il pulsante segue il cursore, e raggio di attrazione in px. */
const MAGNET_PULL = 0.28;

export interface CtaLinkProps {
  href: string;
  className?: string;
  location: LandingEvents["cta_click"]["location"];
  target: LandingEvents["cta_click"]["target"];
  children: ReactNode;
}

/** Link che invia `cta_click` a Umami al click (posizione e destinazione categoriche). */
export function CtaLink({ href, className, location, target, children }: CtaLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  // I pulsanti principali sono leggermente magnetici: seguono il cursore da vicino e tornano a posto all'uscita.
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
    <a ref={ref} href={href} className={className} onClick={() => track("cta_click", { location, target })}>
      {children}
    </a>
  );
}

export const ARROW_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
