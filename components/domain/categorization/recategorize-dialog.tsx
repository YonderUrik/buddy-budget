"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Ricategorizza»: rifà le categorie messe dall'app con le regole e le proposte abbastanza sicure di oggi. Mostra prima cosa
 * cambierebbe, per esercente, e lascia togliere i gruppi che non vanno. I movimenti categorizzati prima che l'app ne
 * segnasse l'origine (forse scelti dall'utente) compaiono nello stesso elenco ma partono senza spunta: nessuna casella
 * in più da capire. Dopo, «Annulla» nel toast o qui dentro per 7 giorni.
 */

import * as React from "react";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialogContent, LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import type { Category } from "@/lib/db/schema/categories";
import { localizedFormats } from "@/lib/localization/format";
import type { RecategorizePreviewGroup } from "@/lib/categorization/recategorize-plan";
import { useRecategorizePreviewQuery } from "@/lib/queries/categorization";
import { LogoCredit } from "@/components/domain/shared";
import { RecategorizeRow } from "./recategorize-row";
import { useRecategorizeActions } from "./use-recategorize";

export interface RecategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  currency: string;
}

export function RecategorizeDialog({ open, onOpenChange, categories, currency }: RecategorizeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Senza il margine sotto: lo dà la barra in fondo, che resta sempre (con «Cambia» o «Chiudi»). */}
      <FormDialogContent className="pb-0">{open ? <RecategorizeBody categories={categories} currency={currency} onDone={() => onOpenChange(false)} /> : null}</FormDialogContent>
    </Dialog>
  );
}

/** Un gruppo parte spuntato solo se tutti i suoi movimenti sono stati categorizzati dall'app (mai «forse scelti da te»). */
function checkedByDefault(group: RecategorizePreviewGroup): boolean {
  return group.legacyCount === 0;
}

function RecategorizeBody({ categories, currency, onDone }: { categories: Category[]; currency: string; onDone: () => void }) {
  const { t: tr, locale } = useLocalization();
  const { formatShortDate } = localizedFormats(locale);
  // Scelte dell'utente sopra il default di ogni gruppo.
  const [choices, setChoices] = React.useState<ReadonlyMap<string, boolean>>(new Map());
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);
  const { data, isLoading, isError, refetch } = useRecategorizePreviewQuery({ includeLegacy: true });
  const { run, undoRun, applying, undoing } = useRecategorizeActions();
  const categoryById = React.useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const trackedFor = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!data || trackedFor.current === data.changes) return;
    trackedFor.current = data.changes;
    track("recategorize_previewed", { scope: "tutto", changes: data.changes });
  }, [data]);

  const groups = data?.groups ?? [];
  const isChecked = (group: RecategorizePreviewGroup) => choices.get(group.key) ?? checkedByDefault(group);
  const selected = groups.filter(isChecked);
  const selectedCount = selected.reduce((sum, group) => sum + group.count, 0);
  const hasMaybeMine = groups.some((group) => group.legacyCount > 0);

  function toggle(key: string, checked: boolean) {
    setChoices((current) => new Map(current).set(key, checked));
  }

  function apply() {
    run(
      // Stesso piano dell'anteprima (con i «forse scelti da te») e sempre i gruppi elencati: si cambia solo ciò che si è visto.
      { scope: "tutto", includeLegacy: true, groupKeys: selected.map((group) => group.key) },
      { onSuccess: onDone }
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg font-medium">{tr("Ricategorizza")}</DialogTitle>
        <DialogDescription>{tr("Rifà le categorie che l'app ha messo da sola, con le tue regole e le tue scelte di oggi. Quelle che hai scelto tu non cambiano.")}</DialogDescription>
      </DialogHeader>

      {data?.lastRun ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2 text-sm">
          <span className="text-muted-foreground">{tr("Ultima volta il")}{" "}{formatShortDate(data.lastRun.createdAt.slice(0, 10))}{":"}{data.lastRun.changed === 1 ? tr("1 movimento") : tr("{0} movimenti", {0: data.lastRun.changed})}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => undoRun(data.lastRun!.id)} disabled={undoing} className="shrink-0">
            <Undo2Icon />{" "}{tr("Annulla")}</Button>
        </div>
      ) : null}

      {isError ? (
        <LoadError message={tr("Impossibile calcolare cosa cambierebbe.")} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-muted/50 p-6 text-center">
          <p className="font-heading text-base font-medium text-foreground">{tr("Niente da cambiare")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{tr("Le categorie messe dall'app sono già quelle che sceglierebbero oggi le tue regole.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.changes === 1 ? tr("1 movimento cambierebbe categoria.") : tr("{0} movimenti cambierebbero categoria.", {0: data.changes})}{" "}{tr("Cambiano solo quelli con la spunta")}{hasMaybeMine ? tr("; quelli «forse scelti da te» partono senza.") : "."}
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {groups.map((group) => (
              <RecategorizeRow
                key={group.key}
                group={group}
                categoryById={categoryById}
                currency={currency}
                checked={isChecked(group)}
                onCheckedChange={(checked) => toggle(group.key, checked)}
                onRemoteLogo={showLogoCredit}
              />
            ))}
          </ul>
          <LogoCredit visible={logosShown} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 mt-auto flex items-center justify-end gap-3 border-t border-border bg-popover px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {data && groups.length === 0 ? (
          <Button type="button" variant="outline" onClick={onDone} className="h-10 px-5 sm:h-9">{tr("Chiudi")}</Button>
        ) : (
          <Button type="button" onClick={apply} disabled={!data || applying || selectedCount === 0} className="h-10 px-5 sm:h-9">
            {!data ? tr("Cambia") : selectedCount === 0 ? tr("Spunta cosa cambiare") : selectedCount === 1 ? tr("Cambia 1 movimento") : tr("Cambia {0} movimenti", {0: selectedCount})}
          </Button>
        )}
      </div>
    </>
  );
}
