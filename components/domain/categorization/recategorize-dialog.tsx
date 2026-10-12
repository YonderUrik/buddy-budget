"use client";

/**
 * «Ricategorizza»: rifà le scelte automatiche sui movimenti già categorizzati da soli, con le regole e le proposte sicure
 * di oggi. Mostra prima cosa cambierebbe, per esercente, e lascia togliere i gruppi che non vanno; i movimenti più
 * vecchi (categorizzati prima che se ne segnasse l'origine, quindi forse scelti da te) entrano solo se richiesto.
 * Dopo, «Annulla» nel toast o qui dentro per 7 giorni.
 */

import * as React from "react";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialogContent, LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { AUTO_APPLY_THRESHOLD } from "@/lib/categorization/suggest";
import { confidencePercent } from "@/lib/categorization/origin";
import type { Category } from "@/lib/db/schema/categories";
import { formatShortDate } from "@/lib/format";
import { useRecategorizePreviewQuery } from "@/lib/queries/categorization";
import { LogoCredit } from "./logo-credit";
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

function RecategorizeBody({ categories, currency, onDone }: { categories: Category[]; currency: string; onDone: () => void }) {
  const [includeLegacy, setIncludeLegacy] = React.useState(false);
  // Gruppi tolti dall'utente: quelli nuovi (cambiando la casella dei più vecchi) partono scelti.
  const [unchecked, setUnchecked] = React.useState<ReadonlySet<string>>(new Set());
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);
  const { data, isLoading, isError, refetch } = useRecategorizePreviewQuery({ includeLegacy });
  const { run, undoRun, applying, undoing } = useRecategorizeActions();
  const categoryById = React.useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  // Il numero dei più vecchi si legge dall'anteprima senza di loro; con la casella accesa resta quello visto.
  const [legacyAvailable, setLegacyAvailable] = React.useState(0);
  if (data && !includeLegacy && data.legacyAvailable !== legacyAvailable) setLegacyAvailable(data.legacyAvailable);

  const trackedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    const key = data ? `${includeLegacy}:${data.changes}` : null;
    if (!data || trackedFor.current === key) return;
    trackedFor.current = key;
    track("recategorize_previewed", { scope: "tutto", changes: data.changes });
  }, [data, includeLegacy]);

  const groups = data?.groups ?? [];
  const selected = groups.filter((group) => !unchecked.has(group.key));
  const selectedCount = selected.reduce((sum, group) => sum + group.count, 0);
  const threshold = confidencePercent(AUTO_APPLY_THRESHOLD);

  function toggle(key: string, checked: boolean) {
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    run(
      { scope: "tutto", includeLegacy, groupKeys: selected.length === groups.length ? undefined : selected.map((group) => group.key) },
      { onSuccess: onDone }
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg font-medium">Ricategorizza</DialogTitle>
        <DialogDescription>
          Rifà le categorie messe da sole con le tue regole di oggi{data?.autoApply === false ? "" : ` e le proposte sicure almeno al ${threshold}%`}. Le
          categorie che hai scelto tu non cambiano.
        </DialogDescription>
      </DialogHeader>

      {data?.lastRun ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Ultima volta il {formatShortDate(data.lastRun.createdAt.slice(0, 10))}: {data.lastRun.changed === 1 ? "1 movimento" : `${data.lastRun.changed} movimenti`}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => undoRun(data.lastRun!.id)} disabled={undoing} className="shrink-0">
            <Undo2Icon /> Annulla
          </Button>
        </div>
      ) : null}

      {legacyAvailable > 0 || includeLegacy ? (
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox checked={includeLegacy} onCheckedChange={(checked) => setIncludeLegacy(checked === true)} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="text-foreground">
              Includi {legacyAvailable === 1 ? "1 movimento più vecchio" : `${legacyAvailable} movimenti più vecchi`}
            </span>
            <span className="text-xs text-muted-foreground">Categorizzati prima che l&apos;app segnasse chi ha scelto: alcuni possono essere scelte tue.</span>
          </span>
        </label>
      ) : null}

      {isError ? (
        <LoadError message="Impossibile calcolare cosa cambierebbe." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-border p-6 text-center">
          <p className="font-heading text-base font-medium text-foreground">Niente da cambiare</p>
          <p className="max-w-sm text-sm text-muted-foreground">Le categorie messe da sole sono già quelle che sceglierebbero oggi le tue regole e le proposte sicure.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.changes === 1 ? "1 movimento cambierebbe categoria." : `${data.changes} movimenti cambierebbero categoria.`} Togli la spunta a quelli che vuoi lasciare
            come sono.
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {groups.map((group) => (
              <RecategorizeRow
                key={group.key}
                group={group}
                categoryById={categoryById}
                currency={currency}
                checked={!unchecked.has(group.key)}
                onCheckedChange={(checked) => toggle(group.key, checked)}
                onRemoteLogo={showLogoCredit}
              />
            ))}
          </ul>
          <LogoCredit visible={logosShown} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 mt-auto flex items-center justify-end gap-3 border-t border-border bg-popover/95 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {data && groups.length === 0 ? (
          <Button type="button" variant="outline" onClick={onDone} className="h-10 px-5 sm:h-9">
            Chiudi
          </Button>
        ) : (
          <Button type="button" onClick={apply} disabled={!data || applying || selectedCount === 0} className="h-10 px-5 sm:h-9">
            {!data ? "Cambia" : selectedCount === 1 ? "Cambia 1 movimento" : `Cambia ${selectedCount} movimenti`}
          </Button>
        )}
      </div>
    </>
  );
}
