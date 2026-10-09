"use client";

/**
 * Grafico a tutta larghezza dello sfondo del login: una sola linea, il patrimonio netto, con area sfumata sotto.
 * Si disegna all'ingresso e si trasforma quando arriva un nuovo valore; il punto finale ha l'etichetta diretta
 * ("Patrimonio netto" e importo), così non serve una legenda. Decorativo: l'importo è già nel testo accanto.
 */

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { buildLinePaths } from "./login-mosaic.model";
import { STORY_EASE } from "./story-motion";
import { useElementSize } from "./use-element-size";

/** Margine sopra e sotto la linea: su desktop lascia libera la fila delle aree e c'è posto per l'etichetta. */
const PAD_DESKTOP = 112;
const PAD_MOBILE = 64;
const DESKTOP_MIN_WIDTH = 1024;
const DRAW_S = 1.8;
const MORPH_S = 0.9;
/** Distanza dell'etichetta dal punto finale, in px. */
const LABEL_OFFSET_Y = 54;
/** Distanza dell'etichetta di un punto annotato dal punto, in px. */
const MILESTONE_LABEL_GAP = 34;
const LABEL_OFFSET_X = 20;

/** Un fatto sulla linea: l'indice del punto della serie e la breve etichetta che lo spiega. */
export interface HorizonMilestone {
  index: number;
  label: string;
}

/** Ritardo dell'ingresso del primo punto (dopo il disegno della linea) e tra un punto e il successivo, in secondi. */
const MILESTONE_DELAY_S = DRAW_S + 0.2;
const MILESTONE_STAGGER_S = 0.35;

export interface LoginHorizonChartProps {
  values: readonly number[];
  label: string;
  /** Pochi punti annotati (2-3) che spiegano cosa fa muovere la linea; nascosti sotto il breakpoint desktop. */
  milestones?: readonly HorizonMilestone[];
  className?: string;
}

export function LoginHorizonChart({ values, label, milestones = [], className }: LoginHorizonChartProps) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const gradientId = React.useId();
  const padY = width >= DESKTOP_MIN_WIDTH ? PAD_DESKTOP : PAD_MOBILE;
  const paths =
    width > 0 && height > 0
      ? buildLinePaths(values, { width, height, padX: 0, padY })
      : null;
  const last = values[values.length - 1] ?? 0;
  const showMilestones = width >= DESKTOP_MIN_WIDTH;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pointAt = (index: number) => ({
    x: (index / (values.length - 1)) * width,
    y: padY + (height - padY * 2) * (1 - (values[index] - min) / span),
  });

  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none relative", className)}>
      {paths ? (
        <>
          <svg width={width} height={height} className="absolute inset-0 block overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--primary)" }} stopOpacity={0.3} />
                <stop offset="1" style={{ stopColor: "var(--primary)" }} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <motion.path
              fill={`url(#${gradientId})`}
              initial={{ opacity: 0, d: paths.area }}
              animate={{ opacity: 1, d: paths.area }}
              transition={{ opacity: { duration: 1.6, delay: 0.4 }, d: { duration: MORPH_S, ease: STORY_EASE } }}
            />
            <motion.path
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: "var(--primary)" }}
              initial={{ pathLength: 0, d: paths.line }}
              animate={{ pathLength: 1, d: paths.line }}
              transition={{ pathLength: { duration: DRAW_S, ease: "easeOut" }, d: { duration: MORPH_S, ease: STORY_EASE } }}
            />
            <motion.circle
              r={5}
              style={{ fill: "var(--primary)" }}
              initial={{ opacity: 0, cx: paths.lastX, cy: paths.lastY }}
              animate={{ opacity: 1, cx: paths.lastX - 5, cy: paths.lastY }}
              transition={{ opacity: { delay: DRAW_S }, cx: { duration: MORPH_S }, cy: { duration: MORPH_S, ease: STORY_EASE } }}
            />
          </svg>
          {showMilestones
            ? milestones.map((milestone, i) => {
                const { x, y } = pointAt(milestone.index);
                return (
                  <motion.div
                    key={milestone.label}
                    className="absolute"
                    style={{ left: x, top: y }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: MILESTONE_DELAY_S + i * MILESTONE_STAGGER_S, duration: 0.5, ease: STORY_EASE }}
                  >
                    <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                    <span className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-text-2" style={{ top: -MILESTONE_LABEL_GAP }}>
                      {milestone.label}
                    </span>
                  </motion.div>
                );
              })
            : null}
          <motion.div
            className="absolute right-6 text-right leading-tight"
            initial={{ opacity: 0, top: paths.lastY - LABEL_OFFSET_Y }}
            animate={{ opacity: 1, top: paths.lastY - LABEL_OFFSET_Y }}
            transition={{ opacity: { delay: DRAW_S, duration: 0.5 }, top: { duration: MORPH_S, ease: STORY_EASE } }}
            style={{ marginRight: LABEL_OFFSET_X - 20 }}
          >
            <span className="block text-xs text-text-3">{label}</span>
            <span className="block font-heading text-base font-medium text-foreground tabular-nums">
              {formatCurrency(last, "EUR", { maximumFractionDigits: 0 })}
            </span>
          </motion.div>
        </>
      ) : null}
    </div>
  );
}
