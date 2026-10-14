"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Foglio «Personalizza» del passo «Categorie» dell'onboarding: un elenco per gruppo con un interruttore per categoria,
 * nome modificabile e «Aggiungi» in fondo a ogni gruppo. Sul telefono è un foglio dal basso, su desktop un dialog.
 * Le modifiche valgono subito nello stato del passo: «Fatto» chiude soltanto.
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UseCategorySetupResult } from "./use-category-setup";
import { CategorySetupRow } from "./category-setup-row";
import { CategorySetupAdd } from "./category-setup-add";
import { SETUP_GROUPS } from "./category-setup-groups";
import { cn } from "@/lib/utils";

export interface CategorySetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setup: UseCategorySetupResult;
  title?: string;
  description?: string;
}

export function CategorySetupSheet({
  open,
  onOpenChange,
  setup,
  title = "Personalizza le categorie",
  description = "Spegni quelle che non usi e tocca un nome per cambiarlo.",
}: CategorySetupSheetProps) {
  const { t: tr } = useLocalization();
  const activeCount = setup.items.filter((item) => item.enabled).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[85dvh] sm:max-w-lg max-sm:px-0 max-sm:pb-0">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4 max-sm:pt-2">
          <DialogTitle className="font-heading text-lg font-medium">{tr(title)}</DialogTitle>
          <DialogDescription>{tr(description)}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          {SETUP_GROUPS.map((group) => (
            <section key={group.type} aria-label={tr(group.label)}>
              <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-popover pt-4 pb-1 text-xs font-medium text-muted-foreground">
                <span className={cn("size-2 rounded-full", group.dotClassName)} aria-hidden="true" />
                {tr(group.label)}
              </h3>
              <ul>
                {setup.items.map((item, index) =>
                  item.type === group.type ? (
                    <CategorySetupRow
                      key={`${item.key ?? "nuova"}-${index}`}
                      item={item}
                      onToggle={(enabled) => setup.toggle(index, enabled)}
                      onRename={(name) => setup.rename(index, name)}
                    />
                  ) : null
                )}
              </ul>
              <CategorySetupAdd type={group.type} groupLabel={group.label} onAdd={setup.add} />
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {setup.problem && (
            <p className="text-sm text-neg" role="alert">
              {setup.problem}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={setup.reset} disabled={!setup.customized} className="h-11 cursor-pointer sm:h-9">{tr("Ripristina")}</Button>
            <Button type="button" onClick={() => onOpenChange(false)} className="h-11 cursor-pointer sm:h-9">{tr("Fatto ·")}{" "}{activeCount}{" "}{tr("attive")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
