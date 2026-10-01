"use client";

/**
 * LoginMosaic
 *
 * Pannello illustrativo delle pagine di autenticazione: mostra in una sola schermata tutto ciò che fa BuddyBudget
 * (patrimonio netto, movimenti, investimenti, debiti, conti, cash flow). Le tessere sono collegate da un unico flusso
 * di movimenti di esempio: quando ne arriva uno cambiano insieme saldi, patrimonio, debito, portafoglio e cash flow,
 * così si capisce che è un solo quadro e non sei strumenti separati. Con `prefers-reduced-motion` resta uno stato fermo.
 * L'animazione è decorativa: il contenuto è descritto a parole per gli screen reader.
 */

import { MotionConfig, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { MosaicAccountsTile } from "./mosaic-accounts-tile";
import { MosaicCashflowTile } from "./mosaic-cashflow-tile";
import { MosaicDebtTile } from "./mosaic-debt-tile";
import { MosaicInvestmentsTile } from "./mosaic-investments-tile";
import { MosaicMovementsTile } from "./mosaic-movements-tile";
import { MosaicNetWorthTile } from "./mosaic-net-worth-tile";
import { useMosaicLive } from "./use-mosaic-live";

/** Sotto questa altezza di viewport (px) la riga Conti / Cash flow si nasconde, per non allungare il pannello. */
const HIDE_LOWER_ROW_BELOW = "[@media(max-height:1100px)]:hidden";

export interface LoginMosaicProps {
  className?: string;
}

export function LoginMosaic({ className }: LoginMosaicProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const live = useMosaicLive(!reduceMotion);

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <p className="sr-only">
        Esempio: BuddyBudget mette in un solo quadro il patrimonio netto, i movimenti della banca già categorizzati, gli
        investimenti, i debiti con le rate, i conti e il cash flow. Quando arriva un movimento, tutti i numeri si
        aggiornano insieme.
      </p>

      <MotionConfig reducedMotion="user">
        <div aria-hidden="true">
          <div className="grid grid-cols-2 gap-3">
            <MosaicNetWorthTile live={live} className="col-span-2" />
            <MosaicMovementsTile feed={live.feed} className="row-span-2" />
            <MosaicInvestmentsTile live={live} />
            <MosaicDebtTile live={live} />
            <MosaicAccountsTile live={live} className={HIDE_LOWER_ROW_BELOW} />
            <MosaicCashflowTile live={live} className={HIDE_LOWER_ROW_BELOW} />
          </div>
        </div>
      </MotionConfig>
    </div>
  );
}
