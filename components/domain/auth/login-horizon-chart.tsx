"use client";

/**
 * Grafico a tutta larghezza dello sfondo del login: una sola linea, il patrimonio netto di esempio, che scorre come
 * un nastro. La scala è fissa: a ogni periodo un punto nuovo entra da destra e i vecchi escono a sinistra, quindi la
 * linea non si alza né si abbassa tutta insieme. Il punto finale ha l'etichetta diretta e ogni `HORIZON_MILESTONE_EVERY`
 * periodi compare un punto annotato che scorre con la linea. Con `prefers-reduced-motion` resta fermo. Decorativo.
 */

import * as React from "react";
import { motion, useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  formatThousands,
  HORIZON_MILESTONE_EVERY,
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
const MILESTONE_LABEL_GAP = 34;
/** Punti disegnati oltre i bordi, per non mostrare buchi mentre scorre. */
const EDGE_POINTS = 2;
/** Larghezza della sfumatura dei punti annotati ai bordi e spazio libero a destra per l'etichetta finale, in px. */
const MILESTONE_FADE_PX = 120;
const RIGHT_CLEARANCE_PX = 200;

export interface LoginHorizonChartProps {
  /** Serie dei livelli (condivisa col numero grande, così i due restano coerenti). */
  series: HorizonSeries;
  /** Etichetta del punto finale. */
  label: string;
  /** Testi dei punti annotati, a rotazione. */
  milestones?: readonly string[];
  /** Chiamata quando il periodo corrente cambia (un periodo intero ogni `1 / HORIZON_SCROLL_SPEED` secondi). */
  onPeriod?: (period: number) => void;
  className?: string;
}

export function LoginHorizonChart({ series, label, milestones = [], onPeriod, className }: LoginHorizonChartProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const clipId = React.useId();
  const gradientId = React.useId();
  const lineRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const dotRef = React.useRef<SVGCircleElement>(null);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const milestoneRefs = React.useRef(new Map<number, HTMLDivElement>());
  const lastPeriod = React.useRef(HORIZON_START_K);
  /** Scorrimento corrente: i punti annotati appena montati si posizionano da qui, senza saltare in un fotogramma. */
  const scrollRef = React.useRef(HORIZON_START_K);
  const [period, setPeriod] = React.useState(HORIZON_START_K);

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
  const showMilestones = isDesktop && milestones.length > 0;
  const step = width / HORIZON_POINTS;

  const yOf = React.useCallback(
    (level: number) => padTop + (height - padTop - padBottom) * (1 - (level - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)),
    [padTop, padBottom, height],
  );

  /** Posiziona un punto annotato per lo scorrimento `s`; sfuma ai bordi (a destra lascia spazio all'etichetta finale). */
  const placeMilestone = React.useCallback(
    (element: HTMLDivElement, k: number, s: number) => {
      const x = (k - s) * step;
      element.style.transform = `translate(${x}px, ${yOf(series.levelAt(k))}px)`;
      element.style.opacity = String(
        Math.max(0, Math.min(1, (x - MILESTONE_FADE_PX / 2) / MILESTONE_FADE_PX, (width - RIGHT_CLEARANCE_PX - x) / MILESTONE_FADE_PX)),
      );
    },
    [step, yOf, width, series],
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

      scrollRef.current = s;
      milestoneRefs.current.forEach((element, k) => placeMilestone(element, k, s));

      const whole = Math.floor(s);
      if (whole !== lastPeriod.current) {
        lastPeriod.current = whole;
        setPeriod(whole);
        onPeriod?.(whole);
      }
    },
    [width, height, step, yOf, onPeriod, placeMilestone, series],
  );

  // Stato fermo (e primo disegno): posizione di partenza. Con reduced motion non scorre mai.
  React.useEffect(() => paint(HORIZON_START_K), [paint]);

  useAnimationFrame((time) => {
    if (reduceMotion) return;
    const elapsed = time / 1000 - DRAW_S;
    if (elapsed <= 0) return;
    paint(HORIZON_START_K + elapsed * HORIZON_SCROLL_SPEED);
  });

  // Punti annotati presenti nella finestra (più uno per lato mentre entrano/escono).
  const milestoneKs: number[] = [];
  if (showMilestones) {
    const from = period - EDGE_POINTS;
    const to = period + HORIZON_POINTS + EDGE_POINTS;
    for (let k = Math.ceil(from / HORIZON_MILESTONE_EVERY) * HORIZON_MILESTONE_EVERY; k <= to; k += HORIZON_MILESTONE_EVERY) milestoneKs.push(k);
  }

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

          {milestoneKs.map((k) => (
            <div
              key={k}
              ref={(element) => {
                if (element) {
                  milestoneRefs.current.set(k, element);
                  placeMilestone(element, k, scrollRef.current);
                } else milestoneRefs.current.delete(k);
              }}
              className="absolute left-0 top-0 opacity-0 will-change-transform"
            >
              <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
              <span className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-text-2" style={{ top: -MILESTONE_LABEL_GAP }}>
                {milestones[(k / HORIZON_MILESTONE_EVERY) % milestones.length]}
              </span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
