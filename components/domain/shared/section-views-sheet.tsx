"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Foglio dal basso con le viste di una sezione (icona, nome, descrizione): lo apre il titolo di `SectionHeading` su telefono. */

import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SectionTab } from "./section-tabs";

const VIEW_ICON_SIZE = 20;

export interface SectionViewsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome della sezione, titolo del foglio (es. «Liquidità»). */
  title: string;
  tabs: readonly SectionTab[];
  activeIndex: number;
  /** Chiamata alla scelta di una vista diversa da quella corrente (prima della navigazione). */
  onChoose?: (tab: SectionTab) => void;
}

export function SectionViewsSheet({ open, onOpenChange, title, tabs, activeIndex, onChoose }: SectionViewsSheetProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogTitle className="px-1 font-heading text-lg font-medium">{tr(title)}</DialogTitle>
        <nav aria-label={tr("Viste di {0}", {0: title})}>
          <ul className="flex flex-col gap-1">
            {tabs.map((tab, index) => {
              const active = index === activeIndex;
              const Icon = tab.icon;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      if (!active) onChoose?.(tab);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex min-h-14 items-center gap-3.5 rounded-xl px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    {Icon ? (
                      <Icon size={VIEW_ICON_SIZE} aria-hidden="true" className={cn("shrink-0", active ? "text-primary" : "text-text-2")} />
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base font-medium text-foreground">{tr(tab.label)}</span>
                      {tab.description ? <span className="text-sm text-text-2">{tr(tab.description)}</span> : null}
                    </span>
                    {active ? <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
