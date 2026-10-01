"use client";

/**
 * Campi delle regole di una linea di credito (fido, indice, spread, addebito degli interessi, soglia di allerta, spese),
 * condivisi dal form di creazione e dalle impostazioni. Nessuna regola è cablata: sono tutte scelte dell'utente.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AlertKind, CreditLineFormState } from "@/lib/debts/credit-line-form";
import type { CreditLineDayCount, CreditLineFrequency } from "@/lib/db/schema/debts";
import { AddDebtCostsField } from "./add-debt-costs-field";
import { DebtFormField } from "./debt-form-field";

export const FREQUENCY_LABELS: Record<CreditLineFrequency, string> = { monthly: "Ogni mese", quarterly: "Ogni trimestre" };
export const DAY_COUNT_LABELS: Record<CreditLineDayCount, string> = { "360": "360 giorni", "365": "365 giorni", actual: "Giorni effettivi (365/366)" };
const ALERT_LABELS: Record<AlertKind, string> = { none: "Nessuna soglia", percent: "% del fido", amount: "Importo" };

export interface CreditLineFormFieldsProps {
  state: CreditLineFormState;
  onChange: (state: CreditLineFormState) => void;
  /** Con `creating` compaiono anche i dati iniziali (utilizzato, indice, data di inizio). */
  creating: boolean;
}

function labelOf<K extends string>(labels: Record<K, string>) {
  return (value: string | null) => (value ? labels[value as K] : "");
}

export function CreditLineFormFields({ state, onChange, creating }: CreditLineFormFieldsProps) {
  const id = React.useId();
  const set = (patch: Partial<CreditLineFormState>) => onChange({ ...state, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <DebtFormField label="Nome" htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} value={state.name} placeholder="Es. Credit Lombard" onChange={(e) => set({ name: e.target.value })} />
      </DebtFormField>

      <div className="grid grid-cols-2 gap-3">
        <DebtFormField label="Fido massimo" htmlFor={`${id}-limit`} hint="Quanto puoi utilizzare al massimo">
          <Input id={`${id}-limit`} inputMode="decimal" value={state.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} />
        </DebtFormField>
        {creating ? (
          <DebtFormField label="Già utilizzato" htmlFor={`${id}-used`} hint="Alla data qui sotto (anche 0)">
            <Input id={`${id}-used`} inputMode="decimal" value={state.initialUsed} onChange={(e) => set({ initialUsed: e.target.value })} />
          </DebtFormField>
        ) : null}
      </div>

      {creating ? (
        <DebtFormField label="Tieni traccia da" htmlFor={`${id}-open`} hint="L'apertura della linea o oggi: prima di questa data non c'è storico">
          <Input id={`${id}-open`} type="date" value={state.openDate} onChange={(e) => set({ openDate: e.target.value })} />
        </DebtFormField>
      ) : null}

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasso</legend>
        <div className="grid grid-cols-2 gap-3">
          {creating ? (
            <DebtFormField label="Indice (%)" htmlFor={`${id}-index`} hint="Es. Euribor di oggi. Se il tasso è fisso, scrivi il tasso e lascia lo spread a 0">
              <Input id={`${id}-index`} inputMode="decimal" value={state.indexRate} onChange={(e) => set({ indexRate: e.target.value })} />
            </DebtFormField>
          ) : null}
          <DebtFormField label="Spread (punti %)" htmlFor={`${id}-spread`} hint="Quanto la banca aggiunge all'indice">
            <Input id={`${id}-spread`} inputMode="decimal" value={state.spread} onChange={(e) => set({ spread: e.target.value })} />
          </DebtFormField>
          <DebtFormField label="Nome dell'indice" htmlFor={`${id}-label`} hint="Facoltativo, solo per ricordarlo">
            <Input id={`${id}-label`} value={state.indexLabel} placeholder="Euribor 3M" onChange={(e) => set({ indexLabel: e.target.value })} />
          </DebtFormField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Come si addebitano gli interessi</legend>
        <p className="text-xs text-muted-foreground">Controlla questi valori sul contratto: noi proponiamo i più comuni, ma contano quelli della tua banca.</p>
        <div className="grid grid-cols-2 gap-3">
          <DebtFormField label="Addebito" htmlFor={`${id}-freq`}>
            <Select value={state.interestFrequency} onValueChange={(v) => v && set({ interestFrequency: v as CreditLineFrequency })}>
              <SelectTrigger id={`${id}-freq`}>
                <SelectValue>{labelOf(FREQUENCY_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABELS) as CreditLineFrequency[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {FREQUENCY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DebtFormField>
          <DebtFormField label="Base del giorno" htmlFor={`${id}-days`}>
            <Select value={state.dayCount} onValueChange={(v) => v && set({ dayCount: v as CreditLineDayCount })}>
              <SelectTrigger id={`${id}-days`}>
                <SelectValue>{labelOf(DAY_COUNT_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DAY_COUNT_LABELS) as CreditLineDayCount[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {DAY_COUNT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DebtFormField>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm text-foreground">
          <span>
            Gli interessi si sommano al capitale
            <span className="block text-xs text-muted-foreground">Dopo l&apos;addebito pagheresti interessi anche su di loro</span>
          </span>
          <Switch checked={state.capitalizeInterest} onCheckedChange={(checked) => set({ capitalizeInterest: checked })} aria-label="Gli interessi si sommano al capitale" />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Soglia di allerta</legend>
        <p className="text-xs text-muted-foreground">Ti avvisiamo quando l&apos;utilizzato la raggiunge. È indipendente da qualsiasi altra cosa.</p>
        <div className="grid grid-cols-2 gap-3">
          <DebtFormField label="Tipo" htmlFor={`${id}-alert`}>
            <Select value={state.alertKind} onValueChange={(v) => v && set({ alertKind: v as AlertKind })}>
              <SelectTrigger id={`${id}-alert`}>
                <SelectValue>{labelOf(ALERT_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ALERT_LABELS) as AlertKind[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ALERT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DebtFormField>
          {state.alertKind !== "none" ? (
            <DebtFormField label={state.alertKind === "percent" ? "Percentuale" : "Importo"} htmlFor={`${id}-alert-value`}>
              <Input id={`${id}-alert-value`} inputMode="decimal" value={state.alertValue} onChange={(e) => set({ alertValue: e.target.value })} />
            </DebtFormField>
          ) : null}
        </div>
      </fieldset>

      <DebtFormField label="Spese della linea" hint="Commissione sul fido, tenuta del conto: «Una tantum» all'apertura, «Ogni rata» a ogni addebito degli interessi">
        <AddDebtCostsField costs={state.costs} onChange={(costs) => set({ costs })} />
      </DebtFormField>
    </div>
  );
}
