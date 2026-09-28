"use client";

/**
 * PAC dell'utente: importo, frequenza e giorno, con "Registra esecuzione" che apre il form precompilato. Il PAC non
 * crea operazioni da solo: prezzo e quote reali li decide il broker. Da qui si crea anche un nuovo PAC.
 */

import * as React from "react";
import { PauseIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Instrument, InvestmentPlan } from "@/lib/db/schema/investments";
import { daysUntil, nextPlanDate } from "@/lib/investments/insights";
import { PLAN_FREQUENCY_LABELS, PLAN_FREQUENCY_MONTHS } from "@/lib/investments/labels";
import { formatCurrency } from "@/lib/format";
import { useCreatePlanMutation, useDeletePlanMutation, useUpdatePlanMutation } from "@/lib/queries/investments";
import { PLAN_MAX_DAY_OF_MONTH } from "@/lib/validation/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { InstrumentPicker } from "./instrument-picker";

export interface PlansCardProps {
  plans: InvestmentPlan[];
  instrumentsById: Map<string, Instrument>;
  currency: string;
  /** Data di oggi, per il prossimo versamento. */
  today: Date;
  onRegisterExecution: (plan: InvestmentPlan) => void;
}

const NEXT_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

function whenText(days: number): string {
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  return `tra ${days} giorni`;
}

function NewPlanForm({ currency, onDone }: { currency: string; onDone: () => void }) {
  const create = useCreatePlanMutation();
  const [instrument, setInstrument] = React.useState<Instrument | null>(null);
  const [amount, setAmount] = React.useState("");
  const [day, setDay] = React.useState("5");
  const parsedDay = Number(day);
  const valid = instrument && (parseAmount(amount) ?? 0) > 0 && parsedDay >= 1 && parsedDay <= PLAN_MAX_DAY_OF_MONTH;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    create.mutate({ instrumentId: instrument.id, amount: parseAmount(amount)!, dayOfMonth: parsedDay, frequency: "mensile" }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:px-6">
      <InstrumentPicker value={instrument} onChange={setInstrument} defaultCurrency={currency} />
      <div className="flex gap-2">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Importo mensile (${currency})`} aria-label="Importo mensile" />
        <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className="w-24" aria-label="Giorno del mese" title={`Giorno del mese (1-${PLAN_MAX_DAY_OF_MONTH})`} />
      </div>
      {create.isError ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valid || create.isPending}>
          Salva PAC
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

export function PlansCard({ plans, instrumentsById, currency, today, onRegisterExecution }: PlansCardProps) {
  const [adding, setAdding] = React.useState(false);
  const update = useUpdatePlanMutation();
  const remove = useDeletePlanMutation();
  const yearly = plans
    .filter((p) => p.active)
    .reduce((sum, p) => sum + (Number(p.amount) * 12) / PLAN_FREQUENCY_MONTHS[p.frequency], 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Piani di accumulo</CardTitle>
          {yearly > 0 ? (
            <p className="text-sm text-foreground">
              In un anno versi <span className="font-semibold tabular-nums">{formatCurrency(yearly, currency, { maximumFractionDigits: 0 })}</span>{" "}
              senza pensarci.
            </p>
          ) : null}
        </div>
        {!adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            Nuovo PAC
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {plans.length === 0 && !adding ? <p className="px-6 pb-6 text-sm text-muted-foreground">Nessun PAC.</p> : null}
        <ul className="divide-y divide-border">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{instrumentsById.get(plan.instrumentId)?.name ?? "Strumento"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(Number(plan.amount), currency)} {PLAN_FREQUENCY_LABELS[plan.frequency]}, il giorno {plan.dayOfMonth}
                </p>
                {plan.active ? (
                  <p className="text-xs text-foreground">
                    Prossimo versamento il {NEXT_DATE_FORMAT.format(nextPlanDate(plan, today))}, {whenText(daysUntil(nextPlanDate(plan, today), today))}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sospeso</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" disabled={!plan.active} onClick={() => onRegisterExecution(plan)}>
                  Registra esecuzione
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  aria-label={plan.active ? "Sospendi PAC" : "Riattiva PAC"}
                  onClick={() => update.mutate({ id: plan.id, input: { active: !plan.active } })}
                >
                  {plan.active ? <PauseIcon className="size-4" aria-hidden="true" /> : <PlayIcon className="size-4" aria-hidden="true" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-9" aria-label="Elimina PAC" onClick={() => remove.mutate(plan.id)}>
                  <Trash2Icon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {adding ? <NewPlanForm currency={currency} onDone={() => setAdding(false)} /> : null}
      </CardContent>
    </Card>
  );
}
