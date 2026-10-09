"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";

/** Inclinazione iniziale (gradi) e scala della schermata d'apertura: scorrendo torna piatta e a grandezza piena. */
const TILT_DEG = 10;
const START_SCALE = 0.92;

/**
 * Contenitore della schermata d'apertura: entra dal basso e, mentre si scorre, passa da inclinata a frontale
 * (prospettiva 3D legata allo scroll). Con movimento ridotto resta frontale e ferma.
 */
export function HeroShot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const inner = el?.firstElementChild;
      if (!el || !inner) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(el, { opacity: 0, y: 60, duration: 1.2, ease: "expo.out", delay: 0.15 });
        gsap.fromTo(
          inner,
          { rotateX: TILT_DEG, scale: START_SCALE },
          { rotateX: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 90%", end: "top 25%", scrub: 0.6 } },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="hero-shot">
      {children}
    </div>
  );
}
