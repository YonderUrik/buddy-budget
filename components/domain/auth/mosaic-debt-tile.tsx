"use client";

/** Tessera "Debiti": residuo che scende a ogni rata, barra del capitale rimborsato e un "rata pagata" che compare. */

import { AnimatePresence, motion } from "motion/react";
import { CreditCardIcon } from "lucide-react";
import { MosaicTile } from "./mosaic-tile";
import { StoryCountUp } from "./story-count-up";
import { MOSAIC_DEBT, debtPaidShare, type MosaicLive } from "./login-mosaic.model";

export interface MosaicDebtTileProps {
  live: MosaicLive;
  className?: string;
}

export function MosaicDebtTile({ live, className }: MosaicDebtTileProps) {
  const { debt, installment } = live.state;
  const paidPercent = Math.round(debtPaidShare(debt) * 100);
  const justPaid = live.feed[0]?.event.id === "rata" ? live.feed[0].key : null;

  return (
    <MosaicTile
      title="Debiti"
      icon={CreditCardIcon}
      color="var(--neg)"
      aside="finanziamento"
      index={3}
      pulse={justPaid ?? undefined}
      className={className}
    >
      <div className="mt-1 flex items-center gap-2">
        <span className="font-heading text-2xl font-medium tracking-tight">
          <StoryCountUp value={debt} duration={1.2} />
        </span>
        <AnimatePresence>
          {justPaid ? (
            <motion.span
              key={justPaid}
              initial={{ opacity: 0, scale: 0.6, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, transition: { delay: 1.4, duration: 0.4 } }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className="rounded-full bg-pos/15 px-2 py-0.5 text-[11px] font-medium text-pos"
            >
              ✓ rata pagata
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-neg"
          initial={{ width: 0 }}
          animate={{ width: `${paidPercent}%` }}
          transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-text-3">
        <span>
          Rata{" "}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={installment}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="inline-block font-medium text-foreground"
            >
              {installment}
            </motion.span>
          </AnimatePresence>{" "}
          di {MOSAIC_DEBT.installments}
        </span>
        <span>{paidPercent}% rimborsato</span>
      </div>
    </MosaicTile>
  );
}
