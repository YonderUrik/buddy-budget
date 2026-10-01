"use client";

/**
 * Grafico a linea del mosaico: si disegna all'ingresso e, quando cambiano i valori, il tracciato si trasforma
 * dolcemente nel nuovo (stessa struttura di path). Un punto pulsante segna l'ultimo valore. Misura la propria
 * larghezza per non deformare tratto e punto.
 */

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { buildLinePaths } from "./login-mosaic.model";
import { STORY_EASE } from "./story-motion";
import { useElementSize } from "./use-element-size";

export type MosaicChartTone = "primary" | "pos" | "neg";

const TONE_COLOR: Record<MosaicChartTone, string> = {
  primary: "var(--primary)",
  pos: "var(--pos)",
  neg: "var(--neg)",
};

const PAD_X = 4;
const PAD_Y = 8;
/** Durata del disegno iniziale e della trasformazione tra una serie e la successiva, in secondi. */
const DRAW_S = 1.6;
const MORPH_S = 0.9;

export interface MosaicLineChartProps {
  values: readonly number[];
  height: number;
  tone?: MosaicChartTone;
  /** Riempimento sfumato sotto la linea. */
  area?: boolean;
  className?: string;
}

export function MosaicLineChart({ values, height, tone = "primary", area = false, className }: MosaicLineChartProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const gradientId = React.useId();
  const color = TONE_COLOR[tone];
  const paths = width > 0 ? buildLinePaths(values, { width, height, padX: PAD_X, padY: PAD_Y }) : null;

  return (
    <div ref={ref} className={cn("w-full", className)} style={{ height }}>
      {paths ? (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: color }} stopOpacity={0.35} />
              <stop offset="1" style={{ stopColor: color }} stopOpacity={0} />
            </linearGradient>
          </defs>
          {area ? (
            <motion.path
              fill={`url(#${gradientId})`}
              initial={{ opacity: 0, d: paths.area }}
              animate={{ opacity: 1, d: paths.area }}
              transition={{ opacity: { duration: 1.4, delay: 0.5 }, d: { duration: MORPH_S, ease: STORY_EASE } }}
            />
          ) : null}
          <motion.path
            fill="none"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: color }}
            initial={{ pathLength: 0, d: paths.line }}
            animate={{ pathLength: 1, d: paths.line }}
            transition={{ pathLength: { duration: DRAW_S, ease: "easeOut" }, d: { duration: MORPH_S, ease: STORY_EASE } }}
          />
          <motion.circle
            r={3.5}
            style={{ fill: color }}
            initial={{ opacity: 0, cx: paths.lastX, cy: paths.lastY }}
            animate={{ opacity: 1, cx: paths.lastX, cy: paths.lastY }}
            transition={{ opacity: { delay: DRAW_S }, cx: { duration: MORPH_S }, cy: { duration: MORPH_S, ease: STORY_EASE } }}
          />
          <motion.circle
            style={{ stroke: color }}
            fill="none"
            strokeWidth={1.5}
            initial={{ r: 3.5, opacity: 0, cx: paths.lastX, cy: paths.lastY }}
            animate={{ r: [3.5, 11], opacity: [0.7, 0], cx: paths.lastX, cy: paths.lastY }}
            transition={{
              r: { duration: 1.8, repeat: Infinity, delay: DRAW_S },
              opacity: { duration: 1.8, repeat: Infinity, delay: DRAW_S },
              cx: { duration: MORPH_S },
              cy: { duration: MORPH_S, ease: STORY_EASE },
            }}
          />
        </svg>
      ) : null}
    </div>
  );
}
