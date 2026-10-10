"use client";

/**
 * Dettaglio di un abbonamento: importo e cadenza, perché il rilevamento lo propone, storico degli addebiti e le scelte
 * (conferma, «non è un abbonamento», terminato, ripristina). Nome e categoria si cambiano da qui; per quelli aggiunti a
 * mano anche importo, cadenza e prossimo addebito.
 */

import * as React from "react";
import { CheckIcon, HistoryIcon, InfoIcon, RepeatIcon, Trash2Icon, UndoIcon, XIcon } from "lucide-react";
import { DialogActions, DialogSection, DialogSections, PanelDialogHeader } from "@/components/domain/investments";
import { DialogCloseButton, LIQUIDITY_DIALOG_CLASS } from "@/components/domain/liquidity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { SubscriptionCadence } from "@/lib/calc/subscriptions";
import type { Category } from "@/lib/db/schema/categories";
import { parseAmount } from "@/lib/debts/add-form";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import { useDeleteSubscriptionMutation, useSaveSubscriptionMutation, useUpdateSubscriptionMutation } from "@/lib/queries/subscriptions";
import type { SubscriptionItem } from "@/lib/subscriptions/view";
import { itemHint, reasonSentence } from "./subscriptions-format";
import { CadenceSelect, Field, Input, SubscriptionCategoryField } from "./subscription-fields";

/** Quanti addebiti dello storico si mostrano (i più recenti). */
const HISTORY_LIMIT = 12;

export interface SubscriptionDetailDialogProps {
  /** Abbonamento aperto; `null` = dialog chiuso. */
  item: SubscriptionItem | null;
  currency: string;
  today: string;
  categories: readonly Category[];
  onOpenChange: (open: boolean) => void;
}

function Details({ item, currency, today, categories, onDone }: Omit<SubscriptionDetailDialogProps, "onOpenChange"> & { item: SubscriptionItem; onDone: () => void }) {
  const save = useSaveSubscriptionMutation();
  const update = useUpdateSubscriptionMutation();
  const remove = useDeleteSubscriptionMutation();
  const id = React.useId();
  const manual = item.origin === "manuale";
  const [name, setName] = React.useState(item.name);
  const [amount, setAmount] = React.useState(item.amount !== null ? item.amount.toFixed(2).replace(".", ",") : "");
  const [cadence, setCadence] = React.useState<SubscriptionCadence>(item.cadence ?? "mensile");
  const [nextDate, setNextDate] = React.useState(item.nextDate ?? today);
  const [categoryId, setCategoryId] = React.useState(item.categoryId ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const busy = save.isPending || update.isPending || remove.isPending;
  const fail = (e: Error) => setError(e.message);

  /** Conferma/esclude/chiude: per un rilevato senza scelta si crea la riga, altrimenti si aggiorna lo stato. */
  function decide(status: "confermato" | "escluso" | "terminato") {
    setError(null);
    if (item.id) return update.mutate({ id: item.id, input: { status }, origin: item.origin }, { onSuccess: onDone, onError: fail });
    if (item.amount === null || item.cadence === null) return setError("Mancano importo e cadenza");
    save.mutate({ origin: "rilevato", key: item.key, status, name: item.name, amount: item.amount, cadence: item.cadence, categoryId: item.categoryId }, { onSuccess: onDone, onError: fail });
  }

  function saveChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!item.id) return;
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Dai un nome all'abbonamento");
    if (manual && (!value || value <= 0)) return setError("Inserisci l'importo di ogni addebito");
    setError(null);
    update.mutate(
      { id: item.id, origin: item.origin, input: { name: name.trim(), categoryId: categoryId || null, ...(manual ? { amount: value, cadence, nextDate } : {}) } },
      { onSuccess: onDone, onError: fail }
    );
  }

  const archived = item.decision === "escluso" || item.decision === "terminato";
  const history = [...item.charges].reverse().slice(0, HISTORY_LIMIT);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-3xl font-medium tabular-nums">{item.amount !== null ? formatCurrency(item.amount, currency) : "—"}</p>
        <p className="mt-1 text-sm text-text-2">{itemHint(item, today)}</p>
        {item.monthly !== null && item.cadence !== "mensile" ? <p className="text-sm text-text-2">Pesa {formatCurrency(item.monthly, currency)} al mese</p> : null}
      </div>

      <DialogSections>
        {item.reasons.length > 0 ? (
          <DialogSection title="Perché lo vediamo qui" icon={InfoIcon} description="Il riconoscimento è un calcolo sui tuoi movimenti, senza AI: la decisione resta tua.">
            <ul className="flex flex-col gap-1.5 text-sm">
              {item.reasons.map((reason, index) => (
                <li key={index} className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden="true" />
                  <span>{reasonSentence(reason, currency)}</span>
                </li>
              ))}
            </ul>
          </DialogSection>
        ) : null}
        {history.length > 0 ? (
          <DialogSection title="Ultimi addebiti" icon={HistoryIcon}>
            <ul className="flex flex-col divide-y divide-border/60 text-sm">
              {history.map((charge) => (
                <li key={charge.id} className="flex min-h-9 items-center justify-between gap-3">
                  <span className="text-text-2">{formatDateWithYear(charge.date)}</span>
                  <span className="font-mono tabular-nums">{formatCurrency(charge.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </DialogSection>
        ) : null}
        {item.id ? (
          <DialogSection title="Modifica" icon={RepeatIcon}>
            <form onSubmit={saveChanges} className="flex flex-col gap-4">
              <Field label="Nome" htmlFor={`${id}-name`}>
                <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" className="h-11 sm:h-8" />
              </Field>
              {manual ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Importo" htmlFor={`${id}-amount`}>
                      <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 sm:h-8" />
                    </Field>
                    <Field label="Ogni quanto" htmlFor={`${id}-cadence`}>
                      <CadenceSelect id={`${id}-cadence`} value={cadence} onChange={setCadence} />
                    </Field>
                  </div>
                  <Field label="Prossimo addebito" htmlFor={`${id}-next`}>
                    <Input id={`${id}-next`} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-11 sm:h-8" />
                  </Field>
                </>
              ) : null}
              <SubscriptionCategoryField id={`${id}-category`} categories={categories} value={categoryId} onChange={setCategoryId} />
              <Button type="submit" variant="outline" disabled={busy} className="h-11 self-start sm:h-8">Salva le modifiche</Button>
            </form>
          </DialogSection>
        ) : null}
      </DialogSections>

      {error ? <p className="text-sm text-neg" role="alert">{error}</p> : null}
      <DialogActions>
        {item.id ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => remove.mutate({ id: item.id!, origin: item.origin }, { onSuccess: onDone, onError: fail })} className="h-11 gap-1.5 text-text-2 sm:h-8">
            {manual ? <Trash2Icon className="size-4" aria-hidden="true" /> : <UndoIcon className="size-4" aria-hidden="true" />}
            {manual ? "Elimina" : "Ripristina com'era"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          {item.decision !== "escluso" && !manual ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => decide("escluso")} className="h-11 gap-1.5 sm:h-8">
              <XIcon className="size-4" aria-hidden="true" /> Non è un abbonamento
            </Button>
          ) : null}
          {item.decision !== "terminato" && (item.decision !== "da-confermare" || item.activity === "fermo") ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => decide("terminato")} className="h-11 sm:h-8">È terminato</Button>
          ) : null}
          {item.decision !== "confermato" ? (
            <Button type="button" disabled={busy} onClick={() => decide("confermato")} className="h-11 gap-1.5 sm:h-8">
              <CheckIcon className="size-4" aria-hidden="true" /> {archived ? "Rimettilo tra i miei" : "Sì, è un abbonamento"}
            </Button>
          ) : null}
        </div>
      </DialogActions>
    </div>
  );
}

export function SubscriptionDetailDialog({ item, currency, today, categories, onOpenChange }: SubscriptionDetailDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className={LIQUIDITY_DIALOG_CLASS}>
        <DialogCloseButton />
        <PanelDialogHeader className="pr-10" icon={RepeatIcon} title={item?.name ?? "Abbonamento"} description={item?.origin === "manuale" ? "Aggiunto da te" : "Trovato nei tuoi movimenti"} />
        {item ? <Details key={item.key} item={item} currency={currency} today={today} categories={categories} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
