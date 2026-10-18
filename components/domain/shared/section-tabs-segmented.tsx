"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Versione desktop di `SectionTabs`: controllo segmentato di link, con il fondo della vista attiva che scivola. */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import type { SectionTab } from "./section-tabs";


export interface SectionTabsSegmentedProps {
  tabs: readonly SectionTab[];
  activeIndex: number;
  ariaLabel: string;
}

export function SectionTabsSegmented({ tabs, activeIndex, ariaLabel }: SectionTabsSegmentedProps) {
  const { t: tr } = useLocalization();
  const thumbId = React.useId();
  return (
    <nav aria-label={tr(ariaLabel)} className="scrollbar-hidden max-w-full overflow-x-auto">
      <ul className="inline-flex w-max items-center gap-1 rounded-full bg-muted p-1">
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={thumbId}
                    transition={SPRING_BOUNCY}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-background"
                  />
                ) : null}
                <span className="relative">{tr(tab.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
