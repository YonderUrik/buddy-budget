"use client";

/**
 * LoginHorizon
 *
 * Scena delle pagine di autenticazione: il patrimonio netto di esempio come numero grande e come grafico a tutta
 * larghezza sul fondo, il form (`children`) a sinistra e le aree dell'app in fila sotto. Il grafico si aggiorna con i
 * movimenti di esempio di `useMosaicLive`; con `prefers-reduced-motion` resta fermo. Su mobile restano form e grafico.
 */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { LoginAreas } from "./login-areas";
import { LoginHorizonAmount } from "./login-horizon-amount";
import { LoginHorizonChart } from "./login-horizon-chart";
import { MOSAIC_INITIAL_STATE, MOSAIC_NET_POINTS, netWorth } from "./login-mosaic.model";
import { useMosaicLive } from "./use-mosaic-live";

const CHART_LABEL = "Patrimonio netto";
const HERO_CAPTION = "Patrimonio netto · dati di esempio";
const HERO_TITLE = "Conti, investimenti, pensione e debiti in un solo grafico.";
/** Andamento di esempio dell'ultimo anno: fisso e regolare, solo l'ultimo punto segue il patrimonio vivo. */
const BASE_HISTORY = Array.from({ length: MOSAIC_NET_POINTS }, (_, i) => {
  const t = i / (MOSAIC_NET_POINTS - 1);
  const trend = 0.84 + 0.16 * t;
  const wiggle = 0.012 * Math.sin(i * 1.7) * (1 - t * 0.6);
  return Math.round(netWorth(MOSAIC_INITIAL_STATE) * (trend + wiggle));
});
const CHANGE_LABEL = "rispetto a un anno fa";

export interface LoginHorizonProps {
  /** Riga in alto (logo e link al sito). */
  header: React.ReactNode;
  /** Sotto il testo a destra: annunci (novità, in arrivo) e note. */
  aside?: React.ReactNode;
  /** Il form della pagina. */
  children: React.ReactNode;
  className?: string;
}

export function LoginHorizon({ header, aside, children, className }: LoginHorizonProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const live = useMosaicLive(!reduceMotion);
  const net = netWorth(live.state);
  const history = React.useMemo(() => [...BASE_HISTORY.slice(0, -1), net], [net]);
  const change = net - BASE_HISTORY[0];

  return (
    <div className={cn("relative flex min-h-dvh flex-col overflow-hidden bg-background", className)}>
      <p className="sr-only">
        Esempio: BuddyBudget mette in un solo quadro il patrimonio netto, i movimenti della banca già categorizzati, gli
        investimenti, i debiti con le rate, i conti e il cash flow.
      </p>

      <LoginHorizonChart
        values={history}
        label={CHART_LABEL}
        className="absolute inset-x-0 bottom-0 h-[30%] lg:h-[58%]"
      />

      <header className="relative px-6 pt-6 lg:px-14 lg:pt-8">{header}</header>

      <main className="relative flex flex-1 flex-col px-6 pb-[34%] pt-8 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20 lg:px-14 lg:pb-52 lg:pt-[6vh]">
        <div className="w-full max-w-sm">{children}</div>

        <section className="hidden flex-col lg:flex" aria-hidden="true">
          <p className="text-sm text-text-3">{HERO_CAPTION}</p>
          <LoginHorizonAmount value={net} className="mt-1.5 font-heading text-8xl font-medium leading-none tracking-tight" />
          <p className="mt-3 text-base">
            <span className={cn("font-semibold", change >= 0 ? "text-pos" : "text-neg")}>
              {change >= 0 ? "▲ +" : "▼ −"}
              {Math.abs(Math.round(change)).toLocaleString("it-IT")} €
            </span>{" "}
            <span className="text-text-2">{CHANGE_LABEL}</span>
          </p>
          <h2 className="mt-6 max-w-md font-heading text-2xl font-medium leading-snug text-balance">{HERO_TITLE}</h2>
          <div className="mt-6 flex max-w-md flex-col gap-5">{aside}</div>
        </section>
      </main>

      <LoginAreas className="absolute inset-x-14 bottom-8 hidden lg:grid" />
    </div>
  );
}
