"use client";

/**
 * Grafico a tutta larghezza dello sfondo del login: una sola linea, il patrimonio netto di esempio, che scorre come
 * un nastro. La scala è fissa: a ogni periodo un punto nuovo entra da destra e i vecchi escono a sinistra, quindi la
 * linea non si alza né si abbassa tutta insieme. Il punto finale ha l'etichetta diretta. Con `prefers-reduced-motion` resta fermo. Decorativo.
 */

import * as React from "react";
import { motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  formatThousands,
  HORIZON_POINTS,
  HORIZON_SCROLL_SPEED,
  HORIZON_START_K,
  type HorizonSeries,
  smoothPath,
} from "./login-horizon.model";
import { STORY_EASE } from "./story-motion";
import { useElementSize } from "./use-element-size";

/** Margine sotto la linea (lascia libera la fila delle aree) e minimo sopra (c'è posto per l'etichetta). */
const PAD_BOTTOM_DESKTOP = 112;
const PAD_TOP_DESKTOP = 112;
const PAD_MOBILE = 64;
/** Altezza della pagina (da cima) sotto cui su desktop deve stare la linea: sopra c'è il form (fino alle note legali). */
const FORM_CLEARANCE_PX = 600;
/** Altezza minima dell'area in cui disegnare la linea, per non schiacciarla su schermi bassi. */
const MIN_PLOT_PX = 70;
/** Limiti della serie (vedi `WALK_MIN`/`WALK_MAX` nel modello) usati per riempire l'altezza disponibile. */
const LEVEL_MIN = 0.1;
const LEVEL_MAX = 0.9;
const DESKTOP_MIN_WIDTH = 1024;
/** Disegno iniziale della linea (secondi); lo scorrimento parte dopo. */
const DRAW_S = 1.8;
const LABEL_OFFSET_Y = 74;
/** Punti disegnati oltre i bordi, per non mostrare buchi mentre scorre. */
const EDGE_POINTS = 2;

export interface LoginHorizonChartProps {
  /** Serie dei livelli (condivisa col numero grande, così i due restano coerenti). */
  series: HorizonSeries;
  /** Etichetta del punto finale. */
  label: string;
  /** Chiamata quando il periodo corrente cambia (un periodo intero ogni `1 / HORIZON_SCROLL_SPEED` secondi). */
  onPeriod?: (period: number) => void;
  className?: string;
}

export function LoginHorizonChart({ series, label, onPeriod, className }: LoginHorizonChartProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const clipId = React.useId();
  const gradientId = React.useId();
  const lineRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const dotRef = React.useRef<SVGCircleElement>(null);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const lastPeriod = React.useRef(HORIZON_START_K);

  const [pageHeight, setPageHeight] = React.useState(0);
  React.useEffect(() => {
    const page = ref.current?.parentElement;
    if (!page) return;
    const observer = new ResizeObserver(() => setPageHeight(page.clientHeight));
    observer.observe(page);
    return () => observer.disconnect();
  }, [ref]);

  const isDesktop = width >= DESKTOP_MIN_WIDTH;
  const padBottom = isDesktop ? PAD_BOTTOM_DESKTOP : PAD_MOBILE;
  // Su desktop la linea non sale sopra il form: il suo tetto è sotto `FORM_CLEARANCE_PX` dalla cima della pagina.
  const padTop = isDesktop
    ? Math.min(Math.max(PAD_TOP_DESKTOP, FORM_CLEARANCE_PX - (pageHeight - height)), height - padBottom - MIN_PLOT_PX)
    : PAD_MOBILE;
  const step = width / HORIZON_POINTS;

  const yOf = React.useCallback(
    (level: number) => padTop + (height - padTop - padBottom) * (1 - (level - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)),
    [padTop, padBottom, height],
  );

  const paint = React.useCallback(
    (s: number) => {
      if (width <= 0 || height <= 0) return;
      const first = Math.floor(s) - EDGE_POINTS;
      const last = Math.floor(s) + HORIZON_POINTS + EDGE_POINTS;
      const points: { x: number; y: number }[] = [];
      for (let k = first; k <= last; k++) points.push({ x: (k - s) * step, y: yOf(series.levelAt(k)) });
      const line = smoothPath(points);
      lineRef.current?.setAttribute("d", line);
      areaRef.current?.setAttribute("d", `${line} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`);

      const endLevel = series.curveAt(s + HORIZON_POINTS);
      const endY = yOf(endLevel);
      dotRef.current?.setAttribute("cy", String(endY));
      if (labelRef.current) labelRef.current.style.top = `${endY - LABEL_OFFSET_Y}px`;
      if (valueRef.current) valueRef.current.textContent = `${formatThousands(series.valueAt(Math.floor(s) + HORIZON_POINTS))} €`;


      const whole = Math.floor(s);
      if (whole !== lastPeriod.current) {
        lastPeriod.current = whole;
        onPeriod?.(whole);
      }
    },
    [width, height, step, yOf, onPeriod, series],
  );

  // Stato fermo (e primo disegno): posizione di partenza. Con reduced motion non scorre mai.
  React.useEffect(() => paint(HORIZON_START_K), [paint]);

  useAnimationFrame((time) => {
    if (reduceMotion) return;
    const elapsed = time / 1000 - DRAW_S;
    if (elapsed <= 0) return;
    paint(HORIZON_START_K + elapsed * HORIZON_SCROLL_SPEED);
  });

  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none relative overflow-hidden", className)}>
      {width > 0 ? (
        <>
          <svg width={width} height={height} className="absolute inset-0 block">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--primary)" }} stopOpacity={0.3} />
                <stop offset="1" style={{ stopColor: "var(--primary)" }} stopOpacity={0.02} />
              </linearGradient>
              <clipPath id={clipId}>
                <motion.rect
                  x={0}
                  y={0}
                  height={height}
                  initial={{ width: reduceMotion ? width : 0 }}
                  animate={{ width }}
                  transition={{ duration: DRAW_S, ease: "easeOut" }}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path ref={areaRef} fill={`url(#${gradientId})`} />
              <path ref={lineRef} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--primary)" }} />
            </g>
            <motion.circle
              ref={dotRef}
              r={5}
              cx={width - 5}
              style={{ fill: "var(--primary)" }}
              initial={{ opacity: reduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: DRAW_S }}
            />
          </svg>

          <motion.div
            ref={labelRef}
            className="absolute right-6 text-right leading-tight"
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: DRAW_S, duration: 0.5, ease: STORY_EASE }}
          >
            <span className="block text-xs text-text-3">{label}</span>
            <span ref={valueRef} className="block font-heading text-base font-medium tabular-nums text-foreground" />
          </motion.div>

        </>
      ) : null}
    </div>
  );
}
