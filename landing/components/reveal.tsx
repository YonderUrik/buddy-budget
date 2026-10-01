"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";

export interface RevealProps {
  as?: ElementType;
  className?: string;
  /** Spostamento verticale iniziale in px. */
  distance?: number;
  /** Se true anima i figli diretti in sequenza invece del contenitore. */
  stagger?: boolean;
  children: ReactNode;
}

/** Ingresso morbido (dissolvenza e risalita) quando l'elemento entra in vista. Senza movimento resta fermo e visibile. */
export function Reveal({ as: Tag = "div", className, distance = 50, stagger = false, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(stagger ? Array.from(el.children) : el, {
          opacity: 0,
          y: distance,
          duration: 1.1,
          ease: EASE_OUT,
          stagger: stagger ? 0.12 : 0,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
