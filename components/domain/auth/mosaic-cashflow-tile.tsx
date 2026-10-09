"use client";

/** Tessera "Cash flow": entrate e uscite degli ultimi mesi; le barre del mese in corso crescono con i movimenti. */

import { motion } from "motion/react";
import { ArrowLeftRightIcon } from "lucide-react";
import { MosaicTile } from "./mosaic-tile";
import {
  MOSAIC_CASHFLOW_SCALE,
  MOSAIC_CURRENT_MONTH_LABEL,
  MOSAIC_PAST_MONTHS,
  monthSavingsRate,
  type MosaicLive,
} from "./login-mosaic.model";

const BAR_AREA_CLASS = "h-14";

function Bar({ value, toneClass, delay }: { value: number; toneClass: string; delay: number }) {
  const percent = Math.min(100, (value / MOSAIC_CASHFLOW_SCALE) * 100);
  return (
    <motion.i
      className={`block w-full rounded-sm ${toneClass}`}
      initial={{ height: 0 }}
      animate={{ height: `${percent}%` }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay }}
    />
  );
}

export interface MosaicCashflowTileProps {
  live: MosaicLive;
  className?: string;
}

export function MosaicCashflowTile({ live, className }: MosaicCashflowTileProps) {
  const { monthIn, monthOut } = live.state;
  const rate = monthSavingsRate(monthIn, monthOut);
  const months = [
    ...MOSAIC_PAST_MONTHS,
    { label: MOSAIC_CURRENT_MONTH_LABEL, income: monthIn, expense: monthOut },
  ];

  return (
    <MosaicTile
      title="Cash flow"
      icon={ArrowLeftRightIcon}
      color="var(--swatch-teal)"
      index={5}
      pulse={monthIn + monthOut > 0 ? live.step : undefined}
      className={className}
      aside={
        <span className="text-pos">
          {rate === null ? "—" : `risparmi il ${Math.max(0, Math.round(rate * 100))}%`}
        </span>
      }
    >
      <div className={`mt-2 flex items-end gap-1.5 ${BAR_AREA_CLASS}`}>
        {months.map((m, i) => (
          <div key={m.label} className="flex h-full flex-1 flex-col justify-end gap-0.5">
            <Bar value={m.income} toneClass="bg-pos" delay={0.5 + i * 0.07} />
            <Bar value={m.expense} toneClass="bg-neg" delay={0.55 + i * 0.07} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[10px] text-text-3">
        {months.map((m) => (
          <span key={m.label} className="flex-1 text-center">
            {m.label}
          </span>
        ))}
      </div>
    </MosaicTile>
  );
}
