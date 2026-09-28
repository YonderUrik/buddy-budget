"use client";

/**
 * Form "Registra operazione": acquisto, vendita, dividendo, cedola o rimborso. Il cambio compare solo se lo
 * strumento è in un'altra valuta (vuoto = cambio BCE del giorno). Può partire precompilato da un PAC.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVESTMENT_TRANSACTION_TYPES, type Instrument, type InvestmentTransactionType } from "@/lib/db/schema/investments";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";
import { formatCurrency } from "@/lib/format";
import { useCreateInvestmentTransactionMutation } from "@/lib/queries/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { InstrumentPicker } from "./instrument-picker";
import { computeGrossValue, fieldsFor, localTodayKey, priceLabel, quantityLabel } from "./register-operation-form.state";

/** Valori iniziali (es. da un PAC). */
export interface RegisterOperationInitial {
  instrument: Instrument | null;
  type?: InvestmentTransactionType;
  quantity?: number | null;
  price?: number | null;
}

export interface RegisterOperationFormProps {
  currency: string;
  initial?: RegisterOperationInitial;
  onSuccess?: () => void;
}

function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function RegisterOperationForm({ currency, initial, onSuccess }: RegisterOperationFormProps) {
  const id = React.useId();
  const create = useCreateInvestmentTransactionMutation();
  const [instrument, setInstrument] = React.useState<Instrument | null>(initial?.instrument ?? null);
  const [type, setType] = React.useState<InvestmentTransactionType>(initial?.type ?? "acquisto");
  const [date, setDate] = React.useState(localTodayKey());
  const [quantity, setQuantity] = React.useState(numberText(initial?.quantity));
  const [price, setPrice] = React.useState(numberText(initial?.price));
  const [gross, setGross] = React.useState("");
  const [fees, setFees] = React.useState("");
  const [taxes, setTaxes] = React.useState("");
  const [fxRate, setFxRate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const fields = fieldsFor(type);
  const needsFx = instrument !== null && instrument.currency !== currency;
  const grossValue = computeGrossValue(type, parseAmount(quantity), parseAmount(price), parseAmount(gross), instrument?.priceUnit);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!instrument) return setError("Scegli uno strumento");
    create.mutate(
      {
        instrumentId: instrument.id,
        type,
        date,
        quantity: fields.quantity ? (parseAmount(quantity) ?? 0) : 0,
        price: fields.price ? (parseAmount(price) ?? 0) : 0,
        grossAmount: fields.grossAmount ? parseAmount(gross) : null,
        fees: parseAmount(fees) ?? 0,
        taxes: parseAmount(taxes) ?? 0,
        ...(needsFx && parseAmount(fxRate) ? { fxRate: parseAmount(fxRate)! } : {}),
      },
      { onSuccess: () => onSuccess?.(), onError: (e) => setError(e.message) }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <Select value={type} onValueChange={(v) => v && setType(v as InvestmentTransactionType)}>
            <SelectTrigger className="w-full" aria-label="Tipo di operazione">
              <SelectValue>{(v: string | null) => (v ? TRANSACTION_TYPE_LABELS[v as InvestmentTransactionType] : "")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRANSACTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" value={date} max={localTodayKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Strumento">
        <InstrumentPicker value={instrument} onChange={setInstrument} defaultCurrency={currency} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {fields.quantity ? (
          <Field label={quantityLabel(instrument?.priceUnit)} htmlFor={`${id}-qty`}>
            <Input id={`${id}-qty`} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
        ) : null}
        {fields.price ? (
          <Field label={`${priceLabel(instrument?.priceUnit)}${instrument ? ` (${instrument.currency})` : ""}`} htmlFor={`${id}-price`}>
            <Input id={`${id}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        ) : null}
        {fields.grossAmount ? (
          <Field label={`Importo lordo${instrument ? ` (${instrument.currency})` : ""}`} htmlFor={`${id}-gross`}>
            <Input id={`${id}-gross`} inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
        ) : null}
        <Field label={`Commissioni (${currency})`} htmlFor={`${id}-fees`}>
          <Input id={`${id}-fees`} inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
        </Field>
        <Field label={`Imposte trattenute (${currency})`} htmlFor={`${id}-taxes`}>
          <Input id={`${id}-taxes`} inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} placeholder="0" />
        </Field>
        {needsFx ? (
          <Field label={`Cambio 1 ${instrument.currency} = ? ${currency}`} htmlFor={`${id}-fx`}>
            <Input id={`${id}-fx`} inputMode="decimal" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder="BCE del giorno" />
          </Field>
        ) : null}
      </div>
      {grossValue !== null && instrument ? (
        <p className="text-sm text-muted-foreground">
          Controvalore: <span className="font-mono tabular-nums text-foreground">{formatCurrency(grossValue, instrument.currency)}</span>
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={create.isPending || !instrument}>
        {create.isPending ? "Registrazione…" : "Registra operazione"}
      </Button>
    </form>
  );
}
