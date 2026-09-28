"use client";

/**
 * Grafico del capitolo investimenti della storia del login.
 * Fase "collega": lungo il fondo compare una barretta per ogni versamento del PAC e il versato in legenda sale;
 * la linea dello zero (valore = versato) si traccia insieme. Fase "capisci": si disegna quanto il mercato aggiunge o
 * toglie rispetto al versato, mese per mese: verde sopra lo zero, rosso sotto, col mese peggiore e il risultato di
 * oggi segnati. La scala usa tutta l'altezza per le oscillazioni, invece di schiacciarle sotto la crescita del versato.
 * Con reduced motion (gestito da `MotionConfig`) mostra direttamente il grafico completo.
 */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { StoryPhase } from "./login-story.data";
import { buildPacGapChart, type PacStoryPoint } from "./pac-story.utils";
import { StoryCountUp } from "./story-count-up";
import { STORY_EASE } from "./story-row";
import { useElementSize } from "./use-element-size";

/** Margine interno del grafico in alto e in basso, in pixel: lascia spazio alle etichette dei punti. */
const CHART_PADDING_PX = 18;
/** Larghezza di ogni barretta di versamento, in pixel. */
const DEPOSIT_TICK_PX = 3;

export interface PacStoryChartProps {
  series: readonly PacStoryPoint[];
  phase: StoryPhase;
  /** Secondi della fase dei versamenti. */
  investedDrawSeconds: number;
  /** Secondi per disegnare l'andamento del mercato. */
  valueDrawSeconds: number;
  gainColor?: string;
  lossColor?: string;
}

function signedEuro(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${Math.round(Math.abs(amount)).toLocaleString("it-IT")} €`;
}

export function PacStoryChart({
  series,
  phase,
  investedDrawSeconds,
  valueDrawSeconds,
  gainColor = "var(--swatch-emerald)",
  lossColor = "var(--swatch-rose)",
}: PacStoryChartProps) {
  // Disegno alla dimensione reale del riquadro: niente deformazioni, e il tratto (pathLength) arriva in fondo.
  const [plotRef, plot] = useElementSize<HTMLDivElement>();
  const chart = buildPacGapChart(series, { width: plot.width, height: plot.height, padding: CHART_PADDING_PX });
  const ready = plot.width > 0 && plot.height > 0;
  const last = series[series.length - 1];
  const showMarket = phase !== "collega";
  const perDeposit = investedDrawSeconds / Math.max(series.length, 1);
  const endAbove = chart.end.gap >= 0;

  return (
    <div className="flex h-full flex-col gap-2 px-4 pt-3 pb-2.5">
      <div className="flex items-baseline justify-between gap-4 text-xs whitespace-nowrap">
        <span className="text-sidebar-foreground/60">
          Versato{" "}
          <span className="font-heading text-sm text-sidebar-foreground">
            <StoryCountUp value={last.invested} duration={investedDrawSeconds} linear />
          </span>
        </span>
        <motion.span
          initial={false}
          animate={{ opacity: showMarket ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="text-sidebar-foreground/60"
        >
          Valore oggi{" "}
          <span className="font-heading text-sm text-sidebar-foreground">
            {showMarket ? <StoryCountUp from={last.invested} value={last.value} delay={valueDrawSeconds * 0.6} /> : null}
          </span>
        </motion.span>
      </div>

      <div ref={plotRef} className="relative min-h-0 flex-1">
        {ready ? (
          <svg width={plot.width} height={plot.height} className="absolute inset-0 overflow-visible">
            <motion.line
              x1={0}
              x2={plot.width}
              y1={chart.zeroY}
              y2={chart.zeroY}
              stroke="var(--sidebar-foreground)"
              strokeOpacity={0.3}
              strokeWidth={1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: investedDrawSeconds, ease: "linear" }}
            />
            <motion.path
              d={chart.gainArea}
              fill={gainColor}
              initial={{ opacity: 0 }}
              animate={{ opacity: showMarket ? 0.3 : 0 }}
              transition={{ delay: showMarket ? valueDrawSeconds * 0.3 : 0, duration: valueDrawSeconds * 0.7 }}
            />
            <motion.path
              d={chart.lossArea}
              fill={lossColor}
              initial={{ opacity: 0 }}
              animate={{ opacity: showMarket ? 0.35 : 0 }}
              transition={{ delay: showMarket ? valueDrawSeconds * 0.3 : 0, duration: valueDrawSeconds * 0.7 }}
            />
            <motion.path
              d={chart.line}
              fill="none"
              stroke="var(--sidebar-foreground)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: showMarket ? 1 : 0 }}
              transition={{ duration: showMarket ? valueDrawSeconds : 0, ease: "easeInOut" }}
            />
          </svg>
        ) : null}

        {ready ? (
          <span
            className="absolute right-0 pt-0.5 text-[10px] text-sidebar-foreground/45"
            style={{ top: chart.zeroY }}
          >
            pari al versato
          </span>
        ) : null}

        {ready && chart.worst ? (
          <motion.span
            initial={false}
            animate={{ opacity: showMarket ? 1 : 0 }}
            transition={{ delay: showMarket ? valueDrawSeconds * 0.5 : 0, duration: 0.4 }}
            className="absolute -translate-x-1/2 pt-1 text-[11px] whitespace-nowrap text-sidebar-foreground/80"
            style={{ left: chart.worst.x, top: chart.worst.y }}
          >
            mese peggiore {signedEuro(chart.worst.gap)}
          </motion.span>
        ) : null}

        {ready ? (
          <motion.span
            initial={false}
            animate={{ opacity: showMarket ? 1 : 0, scale: showMarket ? 1 : 0.8 }}
            transition={{ delay: showMarket ? valueDrawSeconds : 0, duration: 0.4, ease: STORY_EASE }}
            className={cn(
              "absolute -translate-x-full rounded-md px-1.5 py-0.5 font-heading text-xs whitespace-nowrap text-sidebar-foreground",
              endAbove ? "-translate-y-full" : "translate-y-1"
            )}
            style={{
              left: chart.end.x,
              top: chart.end.y,
              backgroundColor: `color-mix(in oklch, ${endAbove ? gainColor : lossColor} 40%, transparent)`,
            }}
          >
            oggi {signedEuro(chart.end.gap)}
          </motion.span>
        ) : null}
      </div>

      {/* Una barretta per versamento: 150 € ogni mese, sempre uguali, qualunque cosa faccia il mercato. */}
      <div className="relative h-2.5">
        {ready
          ? chart.depositXs.map((x, i) => (
              <motion.span
                key={i}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 0.55 }}
                transition={{ delay: (i + 1) * perDeposit, duration: 0.25, ease: STORY_EASE }}
                className="absolute bottom-0 h-full origin-bottom rounded-full bg-sidebar-foreground"
                style={{ left: x + plot.width / series.length / 2 - DEPOSIT_TICK_PX / 2, width: DEPOSIT_TICK_PX }}
              />
            ))
          : null}
      </div>
      <div className="flex justify-between text-[11px] text-sidebar-foreground/45">
        <span>2 anni fa</span>
        <span>150 € ogni mese</span>
        <span>oggi</span>
      </div>
    </div>
  );
}
