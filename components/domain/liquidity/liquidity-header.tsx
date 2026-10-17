"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Testata di Liquidità: titolo (su telefono è il selettore delle viste), sottotitolo, pulsante "Aggiungi" e le schede della sezione. */

import { FileSpreadsheetIcon, LandmarkIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { SectionHeading, SectionTabs, type SectionTab } from "@/components/domain/shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LiquidityHeaderProps {
  subtitle: string;
  tabs: readonly SectionTab[];
  activeHref: string;
  onAddTransaction: () => void;
  onAddAccount: () => void;
  /** Apre l'import di un file CSV o Excel. */
  onImport: () => void;
}

export function LiquidityHeader({ subtitle, tabs, activeHref, onAddTransaction, onAddAccount, onImport }: LiquidityHeaderProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading
          title={tr("Liquidità")}
          subtitle={tr(subtitle)}
          tabs={tabs}
          activeHref={activeHref}
          analyticsKey="liquidita"
          subtitleClassName="text-text-2"
        />
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "sun" }), "h-11 shrink-0 cursor-pointer gap-1.5 px-4 text-sm")} aria-label={tr("Aggiungi")}>
            <PlusIcon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{tr("Aggiungi")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onAddTransaction}>
              <ReceiptTextIcon className="size-4" aria-hidden="true" />{" "}{tr("Un movimento")}</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onAddAccount}>
              <LandmarkIcon className="size-4" aria-hidden="true" />{" "}{tr("Un conto o una banca")}</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onImport}>
              <FileSpreadsheetIcon className="size-4" aria-hidden="true" />{" "}{tr("Importa da CSV o Excel")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SectionTabs tabs={tabs} activeHref={activeHref} ariaLabel={tr("Sezioni di Liquidità")} />
    </div>
  );
}
