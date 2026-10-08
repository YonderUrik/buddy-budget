"use client";

/** Testata di Liquidità: titolo, sottotitolo, pulsante "Aggiungi" (movimento o conto) e le schede della sezione. */

import { LandmarkIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/domain/shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LiquidityHeaderProps {
  subtitle: string;
  tabs: readonly SectionTab[];
  activeHref: string;
  onAddTransaction: () => void;
  onAddAccount: () => void;
}

export function LiquidityHeader({ subtitle, tabs, activeHref, onAddTransaction, onAddAccount }: LiquidityHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Liquidità</h1>
          <p className="text-text-2">{subtitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants(), "h-11 shrink-0 cursor-pointer gap-1.5 px-4 text-sm shadow-xs")} aria-label="Aggiungi">
            <PlusIcon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Aggiungi</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onAddTransaction}>
              <ReceiptTextIcon className="size-4" aria-hidden="true" /> Un movimento
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onAddAccount}>
              <LandmarkIcon className="size-4" aria-hidden="true" /> Un conto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SectionTabs tabs={tabs} activeHref={activeHref} ariaLabel="Sezioni di Liquidità" />
    </div>
  );
}
