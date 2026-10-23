"use client";

/**
 * «Aggiungi una spesa» in a group, and its change: what it is, how much, when, a category, who paid (any member, also
 * someone without an account) and who it was for (everyone, some people, or only someone else: paid entirely for
 * them). One line under the people says what it means for the balance. Full screen on the phone.
 */

import * as React from "react";
import { CategoryPicker } from "@/components/domain/categories";
import { FormDialogContent, SECTION_TITLE } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { HouseholdExpenseEntry, HouseholdPerson } from "@/lib/households/types";
import { localizedFormats, parseLocaleNumber } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useDeleteGroupExpenseMutation, useSaveGroupExpenseMutation } from "@/lib/queries/households";
import { splitLine } from "./balance-text";
import { PeopleFor, PersonPicker } from "./person-chips";

export interface GroupExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  members: readonly HouseholdPerson[];
  currency: string;
  /** The expense to change; null = a new one. */
  expense: HouseholdExpenseEntry | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function GroupExpenseDialog(props: GroupExpenseDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <FormDialogContent>{props.open ? <GroupExpenseForm key={props.expense?.id ?? "new"} {...props} /> : null}</FormDialogContent>
    </Dialog>
  );
}

function GroupExpenseForm({ onOpenChange, householdId, members, currency, expense }: GroupExpenseDialogProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const me = members.find((m) => m.isMe);
  const categories = (useCategoriesQuery().data ?? []).filter((c) => c.type !== "entrata" && c.type !== "trasferimento");
  const save = useSaveGroupExpenseMutation(householdId, me?.id ?? null);
  const remove = useDeleteGroupExpenseMutation(householdId);
  const [description, setDescription] = React.useState(expense?.description ?? "");
  const [amountText, setAmountText] = React.useState(expense ? formatCurrency(expense.amount, currency).replace(/[^\d.,]/g, "") : "");
  const [date, setDate] = React.useState(expense?.date ?? today());
  const [categoryId, setCategoryId] = React.useState(expense?.category?.id ?? "");
  const [payerId, setPayerId] = React.useState(expense?.payerId ?? me?.id ?? members[0]?.id ?? "");
  const [forIds, setForIds] = React.useState<string[] | null>(expense?.chosenForIds ?? null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const amount = parseLocaleNumber(amountText, locale);
  const valid = description.trim().length > 0 && amount !== null && amount > 0 && Boolean(date) && Boolean(payerId);
  const money = (n: number) => formatCurrency(n, currency);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const done = await save
      .mutateAsync({
        expenseId: expense?.id ?? null,
        expense: { description: description.trim(), amount: amount!, date, paidByMemberId: payerId, forMemberIds: forIds, categoryId: categoryId || null },
      })
      .then(() => true, () => false);
    if (done) onOpenChange(false);
  }

  async function confirmRemove() {
    if (!expense) return;
    const done = await remove.mutateAsync(expense.id).then(() => true, () => false);
    if (done) onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle className={SECTION_TITLE}>{expense ? tr("Modifica la spesa") : tr("Nuova spesa del gruppo")}</DialogTitle>
        <DialogDescription>{tr("Anche se l'ha pagata qualcuno che non è su BuddyBudget.")}</DialogDescription>
      </DialogHeader>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {tr("Cos'è")}
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={tr("Per esempio: cena a Palau")} className="h-12 rounded-full px-5 text-base" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          {tr("Quanto")}
          <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0,00" className="h-12 rounded-full px-5 text-base tabular-nums" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          {tr("Quando")}
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-full px-5 text-base" />
        </label>
      </div>
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        {tr("Categoria")}
        <CategoryPicker categories={categories} value={categoryId} onValueChange={setCategoryId} placeholder={tr("Nessuna (va in «Altro»)")} aria-label={tr("Categoria")} />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-medium">{tr("Chi ha pagato")}</legend>
        <PersonPicker people={members} value={payerId} onChange={setPayerId} ariaLabel="Chi ha pagato" />
      </fieldset>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-medium">{tr("Per chi")}</legend>
        <PeopleFor people={members} value={forIds} onChange={setForIds} ariaLabel="Per chi" />
        <p className="text-sm text-text-2" aria-live="polite">
          {amount && amount > 0 ? splitLine(amount, payerId, forIds, members, money, tr) : tr("Tocca una persona sola se l'hai pagata tutta per lei.")}
        </p>
      </fieldset>

      {save.isError ? <p className="text-sm text-neg">{save.error.message}</p> : null}
      {remove.isError ? <p className="text-sm text-neg">{remove.error.message}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {expense ? (
          confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-full text-sm text-text-2 sm:w-auto">{tr("La togli per tutto il gruppo?")}</span>
              <Button type="button" variant="destructive" className="h-11 rounded-full px-5" onClick={confirmRemove} disabled={remove.isPending}>
                {tr("Sì, elimina")}
              </Button>
              <Button type="button" variant="ghost" className="h-11 rounded-full px-4" onClick={() => setConfirmDelete(false)}>
                {tr("No")}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="h-11 w-fit rounded-full px-4 text-neg" onClick={() => setConfirmDelete(true)}>
              {tr("Elimina la spesa")}
            </Button>
          )
        ) : (
          <span />
        )}
        <Button type="submit" variant="sun" className="h-12 rounded-full px-6" disabled={!valid || save.isPending}>
          {save.isPending ? tr("Salvataggio…") : expense ? tr("Salva") : tr("Aggiungi la spesa")}
        </Button>
      </div>
    </form>
  );
}
