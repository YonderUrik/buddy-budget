"use client";

/**
 * Impostazioni comuni di `motion` per tutta l'app: rispetta il movimento ridotto del sistema (niente spostamenti né
 * scale, restano le dissolvenze) e usa la molla morbida come transizione di default. Va montato una volta nel layout.
 */

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { SPRING_SOFT } from "@/lib/motion/springs";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING_SOFT}>
      {children}
    </MotionConfig>
  );
}
