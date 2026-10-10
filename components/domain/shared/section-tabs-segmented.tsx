"use client";

/** Versione desktop di `SectionTabs`: controllo segmentato di link, con il fondo della vista attiva che scivola. */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import type { SectionTab } from "./section-tabs";

const SEGMENT_ICON_SIZE = 14;

export interface SectionTabsSegmentedProps {
  tabs: readonly SectionTab[];
  activeIndex: number;
  ariaLabel: string;
}

export function SectionTabsSegmented({ tabs, activeIndex, ariaLabel }: SectionTabsSegmentedProps) {
  const thumbId = React.useId();
  return (
    <nav aria-label={ariaLabel} className="max-w-full overflow-x-auto">
      <ul className="inline-flex w-max items-center gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={thumbId}
                    transition={SPRING_BOUNCY}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-md bg-background shadow-sm"
                  />
                ) : null}
                {Icon ? (
                  <Icon
                    size={SEGMENT_ICON_SIZE}
                    aria-hidden="true"
                    className={cn("relative shrink-0", active ? "text-primary" : "text-muted-foreground/70")}
                  />
                ) : null}
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
