"use client";

import { gsap, MOTION_OK, ScrollTrigger, SplitText } from "@/lib/motion/gsap";
import { useEffect } from "react";

/** Titoli di sezione che entrano riga per riga (maschera + risalita). */
const HEADING_SELECTOR = "h2.t";

/** Distanza dal fondo dello schermo a cui parte l'ingresso di un titolo. */
const HEADING_START = "top 86%";

/**
 * Anima i titoli `h2.t` della pagina: ogni riga sale da dietro una maschera quando il titolo entra in vista.
 * Aspetta i font (le righe si calcolano sul testo già impaginato) e si rifà al resize. Senza movimento non fa nulla.
 */
export function HeadingReveals() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    let cancelled = false;
    mm.add(MOTION_OK, () => {
      document.fonts.ready.then(() => {
        if (cancelled) return;
        document.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((heading) => {
          SplitText.create(heading, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 108,
                duration: 1.1,
                ease: "expo.out",
                stagger: 0.09,
                scrollTrigger: { trigger: heading, start: HEADING_START, once: true },
              }),
          });
        });
        ScrollTrigger.refresh();
      });
    });
    return () => {
      cancelled = true;
      mm.revert();
    };
  }, []);

  return null;
}
