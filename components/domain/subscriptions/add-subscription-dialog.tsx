"use client";

/** Dialog «Aggiungi un abbonamento»: per quelli che il rilevamento non vede (pagati in contanti, da un altro conto, appena iniziati). */

import * as React from "react";
import { RepeatIcon } from "lucide-react";
import { DialogActions, PanelDialogHeader } from "@/components/domain/investments";
import { DialogCloseButton, LIQUIDITY_DIALOG_CLASS } from "@/components/domain/liquidity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { SubscriptionCadence } from "@/lib/calc/subscriptions";
import type { Category } from "@/lib/db/schema/categories";
import { parseAmount } from "@/lib/debts/add-form";
import { useSaveSubscriptionMutation } from "@/lib/queries/subscriptions";
import { CadenceSelect, Field, Input, SubscriptionCategoryField } from "./subscription-fields";

export interface AddSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: readonly Category[];
  /** Data di oggi (`YYYY-MM-DD`): proposta come prossimo addebito. */
  today: string;
}

function AddForm({ categories, today, onDone }: Omit<AddSubscriptionDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const mutation = useSaveSubscriptionMutation();
  const id = React.useId();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [cadence, setCadence] = React.useState<SubscriptionCadence>("mensile");
  const [nextDate, setNextDate] = React.useState(today);
  const [categoryId, setCategoryId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Dai un nome all'abbonamento");
    if (!value || value <= 0) return setError("Inserisci l'importo di ogni addebito");
    setError(null);
    mutation.mutate(
      { origin: "manuale", name: name.trim(), amount: value, cadence, nextDate, categoryId: categoryId || null },
      { onSuccess: onDone, onError: (e) => setError(e.message) }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Palestra, Assicurazione casa" maxLength={80} autoComplete="off" className="h-11 sm:h-8" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importo di ogni addebito" htmlFor={`${id}-amount`}>
          <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-11 sm:h-8" />
        </Field>
        <Field label="Ogni quanto" htmlFor={`${id}-cadence`}>
          <CadenceSelect id={`${id}-cadence`} value={cadence} onChange={setCadence} />
        </Field>
      </div>
      <Field label="Prossimo addebito" htmlFor={`${id}-next`}>
        <Input id={`${id}-next`} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-11 sm:h-8" />
      </Field>
      <SubscriptionCategoryField id={`${id}-category`} categories={categories} value={categoryId} onChange={setCategoryId} />
      {error ? <p className="text-sm text-neg" role="alert">{error}</p> : null}
      <DialogActions>
        <span />
        <Button type="submit" disabled={mutation.isPending} className="h-11 sm:h-8">
          {mutation.isPending ? "Salvo…" : "Aggiungi"}
        </Button>
      </DialogActions>
    </form>
  );
}

export function AddSubscriptionDialog({ open, onOpenChange, categories, today }: AddSubscriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={LIQUIDITY_DIALOG_CLASS}>
        <DialogCloseButton />
        <PanelDialogHeader className="pr-10" icon={RepeatIcon} title="Aggiungi un abbonamento" description="Se compare tra i movimenti lo collegheremo da soli e ne seguiremo gli addebiti." />
        {open ? <AddForm key={String(open)} categories={categories} today={today} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
