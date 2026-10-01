"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, MOTION_OK, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Scroll morbido con Lenis, agganciato a ScrollTrigger (stesso ticker, così le animazioni legate allo scroll
 * restano allineate). Gestisce anche i link ad ancora. Con `prefers-reduced-motion` non fa nulla: scroll nativo.
 */
export function SmoothScroll() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const onClick = (e: MouseEvent) => {
        const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
        if (!a || a.getAttribute("href") === "#") return;
        const target = document.querySelector(a.getAttribute("href") as string);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target as HTMLElement, { offset: -10 });
      };
      document.addEventListener("click", onClick);

      return () => {
        document.removeEventListener("click", onClick);
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });
    return () => mm.revert();
  }, []);

  return null;
}
