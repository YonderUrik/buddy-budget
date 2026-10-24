"use client";

/**
 * The result blocks of «Cerca», shared by the desktop panel and the phone screen: a grey title per block and its rows.
 * On the phone every block is a rounded card, like the iOS lists. New rows fade in from slightly below, a few at a time.
 */

import { motion } from "motion/react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { AiRow, CommandCard } from "./command-card";
import { SearchRow } from "./search-row";
import type { SpotlightBlock, SpotlightItem } from "./use-spotlight";

/** Rows after this one appear together (no long cascade). */
const STAGGER_ROWS = 8;
const ROW_ENTER = { duration: 0.18, ease: [0.32, 0.72, 0, 1] } as const;

export interface SpotlightResultsProps {
  blocks: SpotlightBlock[];
  query: string;
  active: number;
  currency: string;
  phone?: boolean;
  moreMovements: number;
  optionId: (index: number) => string;
  onPick: (item: SpotlightItem, index: number) => void;
  onHover: (index: number) => void;
}

export function SpotlightResults({ blocks, query, active, currency, phone = false, moreMovements, optionId, onPick, onHover }: SpotlightResultsProps) {
  const { t: tr } = useLocalization();
  // Position of each block's first row in the whole list (arrow keys move across blocks).
  const starts = blocks.reduce<number[]>((acc, block, i) => [...acc, i === 0 ? 0 : acc[i - 1] + blocks[i - 1].items.length], []);
  return (
    <div className={cn("flex flex-col", phone ? "gap-5" : "gap-2.5")}>
      {blocks.map((block, blockIndex) => (
        <section key={block.id} aria-label={block.title ? tr(block.title) : undefined}>
          {block.title ? <h3 className={cn("px-3 pb-1 font-medium text-text-3", phone ? "text-[13px]" : "text-xs")}>{tr(block.title)}</h3> : null}
          {/* On the phone a block is a rounded card; the command block is a card on its own. */}
          <div className={cn("flex flex-col", phone && block.items[0]?.type !== "command" && "rounded-3xl bg-card/80 p-1.5 dark:bg-foreground/[0.07]")}>
            {block.items.map((item, itemIndex) => {
              const position = starts[blockIndex] + itemIndex;
              const common = { id: optionId(position), selected: position === active, phone, onPick: () => onPick(item, position), onHover: () => onHover(position) };
              return (
                <motion.div key={item.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...ROW_ENTER, delay: Math.min(position, STAGGER_ROWS) * 0.018 }}>
                  {item.type === "hit" ? (
                    <SearchRow {...common} hit={item.hit} query={query} top={block.id === "top"} currency={currency} />
                  ) : item.type === "command" ? (
                    <CommandCard {...common} draft={item.draft} instrument={item.instrument} currency={currency} />
                  ) : (
                    <AiRow {...common} status={item.status} />
                  )}
                </motion.div>
              );
            })}
          </div>
          {block.id === "movimenti" && moreMovements > 0 ? <p className="px-3 pt-1 text-xs text-text-3">{tr("E altri {0} in Movimenti", { 0: String(moreMovements) })}</p> : null}
        </section>
      ))}
    </div>
  );
}
