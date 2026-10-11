"use client";

/**
 * Form "Registra operazione": acquisto, vendita, dividendo, cedola, rimborso o split (solo il rapporto). Per acquisti e vendite il prezzo si
 * precompila col prezzo dello strumento alla data scelta, finché l'utente non lo cambia. Il cambio compare solo se
 * lo strumento è in un'altra valuta (vuoto = cambio BCE del giorno). Può partire precompilato.
 * Con `editing` modifica un'operazione esistente: lo strumento è fisso, i campi partono dai valori salvati e restano
 * in un'unica schermata. Una nuova operazione si registra a passi: tipo e strumento, data e importi, costi (se ci sono).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVESTMENT_TRANSACTION_TYPES, type Instrument, type InvestmentTransactionType } from "@/lib/db/schema/investments";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";
import { formatCurrency } from "@/lib/format";
import {
  useCreateInvestmentTransactionMutation,
  useInstrumentPriceOnDateQuery,
  useUpdateInvestmentTransactionMutation,
} from "@/lib/queries/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { ArrowLeftRightIcon, CoinsIcon } from "lucide-react";
import { DialogActions, DialogSection, DialogSections } from "./dialog-parts";
import { InstrumentPicker } from "./instrument-picker";
import { OperationFormField as Field } from "./operation-form-field";
import { OperationPriceField } from "./operation-price-field";
import {
  computeGrossValue,
  fieldsFor,
  localTodayKey,
  numberText,
  priceLabel,
  priceSuggestionHint,
  priceText,
  quantityLabel,
  SPLIT_RATIO_HINT,
  SPLIT_RATIO_LABEL,
  suggestsMarketPrice,
} from "./register-operation-form.state";

/** Valori iniziali (es. da un suggerimento d'acquisto o da un dividendo da registrare). */
export interface RegisterOperationInitial {
  instrument: Instrument | null;
  type?: InvestmentTransactionType;
  quantity?: number | null;
  price?: number | null;
  date?: string;
  /** Lordo di un dividendo o una cedola, nella valuta dello strumento. */
  grossAmount?: number | null;
  /** Imposte trattenute stimate, nella valuta dell'utente. */
  taxes?: number | null;
  /** Commissioni e cambio salvati, nella modifica di un'operazione. */
  fees?: number | null;
  fxRate?: number | null;
}

/** Operazione che il form sta modificando. */
export interface EditingOperation {
  id: string;
  /** La nota non si modifica dal form: si rimanda com'è, altrimenti la modifica la cancellerebbe. */
  note: string | null;
}

export interface RegisterOperationFormProps {
  currency: string;
  initial?: RegisterOperationInitial;
  /** Strumenti già usati, proposti nel selettore prima di scrivere. */
  usedInstruments?: Instrument[];
  /** Se presente, il form salva le modifiche di questa operazione invece di registrarne una nuova. */
  editing?: EditingOperation;
  onSuccess?: () => void;
}

function roundCents(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

export function RegisterOperationForm({ currency, initial, usedInstruments = [], editing, onSuccess }: RegisterOperationFormProps) {
  const id = React.useId();
  const create = useCreateInvestmentTransactionMutation();
  const update = useUpdateInvestmentTransactionMutation();
  const save = editing ? update : create;
  const [instrument, setInstrument] = React.useState<Instrument | null>(initial?.instrument ?? null);
  const [type, setType] = React.useState<InvestmentTransactionType>(initial?.type ?? "acquisto");
  const [date, setDate] = React.useState(initial?.date ?? localTodayKey());
  const [quantity, setQuantity] = React.useState(numberText(initial?.quantity));
  // null = il campo segue il prezzo proposto; una stringa = valore scritto dall'utente.
  // In modifica parte dal prezzo salvato, non da quello di mercato della data.
  const [priceInput, setPriceInput] = React.useState<string | null>(editing ? numberText(initial?.price) : null);
  const [gross, setGross] = React.useState(numberText(roundCents(initial?.grossAmount)));
  const [fees, setFees] = React.useState(numberText(initial?.fees));
  const [taxes, setTaxes] = React.useState(numberText(roundCents(initial?.taxes)));
  const [fxRate, setFxRate] = React.useState(numberText(initial?.fxRate));
  const [error, setError] = React.useState<string | null>(null);

  const fields = fieldsFor(type);
  const stepCount = editing ? 1 : fields.costs ? 3 : 2;
  const flow = useStepFlow(stepCount);
  const needsFx = fields.costs && instrument !== null && instrument.currency !== currency;
  const suggestPrice = fields.price && suggestsMarketPrice(type);
  const priceOnDate = useInstrumentPriceOnDateQuery(suggestPrice ? (instrument?.id ?? null) : null, date);
  const suggested = suggestPrice && priceOnDate.data?.price ? priceText(priceOnDate.data.price.close) : null;
  // Senza prezzo alla data resta quello di partenza (es. l'ultimo prezzo stimato).
  const price = priceInput ?? suggested ?? numberText(initial?.price);
  const priceHint = suggestPrice && instrument ? priceSuggestionHint(date, priceOnDate.data, priceOnDate.isFetching) : null;
  const grossValue = computeGrossValue(type, parseAmount(quantity), parseAmount(price), parseAmount(gross), instrument?.priceUnit);

  function chooseInstrument(next: Instrument) {
    setInstrument(next);
    // Il prezzo scritto per un altro strumento non vale per questo.
    setPriceInput(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!instrument) return setError("Scegli uno strumento");
    if (!flow.isLast) {
      if (flow.index === 1 && fields.quantity && !(parseAmount(quantity) ?? 0)) return setError(type === "split" ? "Scrivi il rapporto dello split." : "Scrivi la quantità.");
      track("form_step_completed", { flow: "operation", step: flow.index + 1 });
      flow.next();
      return;
    }
    const input = {
      type,
      date,
      quantity: fields.quantity ? (parseAmount(quantity) ?? 0) : 0,
      price: fields.price ? (parseAmount(price) ?? 0) : 0,
      grossAmount: fields.grossAmount ? parseAmount(gross) : null,
      fees: fields.costs ? (parseAmount(fees) ?? 0) : 0,
      taxes: fields.costs ? (parseAmount(taxes) ?? 0) : 0,
      ...(needsFx && parseAmount(fxRate) ? { fxRate: parseAmount(fxRate)! } : {}),
    };
    const callbacks = { onSuccess: () => onSuccess?.(), onError: (e: Error) => setError(e.message) };
    if (editing) update.mutate({ id: editing.id, input: { ...input, note: editing.note } }, callbacks);
    else create.mutate({ ...input, instrumentId: instrument.id }, callbacks);
  }

  const typeField = (
    <Field label="Tipo">
      <Select value={type} onValueChange={(v) => v && setType(v as InvestmentTransactionType)}>
        <SelectTrigger className="w-full" aria-label="Tipo di operazione">
          <SelectValue>{(v: string | null) => (v ? TRANSACTION_TYPE_LABELS[v as InvestmentTransactionType] : "")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {INVESTMENT_TRANSACTION_TYPES.filter((t) => t !== "rettifica").map((t) => (
            <SelectItem key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
  const dateField = (
    <Field label="Data" htmlFor={`${id}-date`}>
      <Input id={`${id}-date`} type="date" value={date} max={localTodayKey()} onChange={(e) => setDate(e.target.value)} />
    </Field>
  );
  const instrumentField = (
    <Field label="Strumento">
      {editing ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{instrument?.name ?? "Strumento"}</p>
      ) : (
        <InstrumentPicker value={instrument} onChange={chooseInstrument} defaultCurrency={currency} suggestions={usedInstruments} />
      )}
    </Field>
  );
  const amountFields = (
    <>
      {fields.quantity ? (
        <Field label={type === "split" ? SPLIT_RATIO_LABEL : quantityLabel(instrument?.priceUnit)} htmlFor={`${id}-qty`}>
          <Input id={`${id}-qty`} data-autofocus={!editing && flow.index === 1 ? "" : undefined} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      ) : null}
      {fields.price ? (
        <OperationPriceField
          id={`${id}-price`}
          label={`${priceLabel(instrument?.priceUnit)}${instrument ? ` (${instrument.currency})` : ""}`}
          value={price}
          onChange={setPriceInput}
          hint={priceHint}
          restoreValue={priceInput !== null && suggested !== null && parseAmount(priceInput) !== parseAmount(suggested) ? suggested : null}
          onRestore={() => setPriceInput(null)}
        />
      ) : null}
      {fields.grossAmount ? (
        <Field label={`Importo lordo${instrument ? ` (${instrument.currency})` : ""}`} htmlFor={`${id}-gross`}>
          <Input id={`${id}-gross`} inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
        </Field>
      ) : null}
    </>
  );
  const costFields = (
    <>
      {fields.costs ? (
        <>
          <Field label={`Commissioni (${currency})`} htmlFor={`${id}-fees`}>
            <Input id={`${id}-fees`} data-autofocus={!editing ? "" : undefined} inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
          </Field>
          <Field label={`Imposte trattenute (${currency})`} htmlFor={`${id}-taxes`}>
            <Input id={`${id}-taxes`} inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} placeholder="0" />
          </Field>
        </>
      ) : null}
      {needsFx ? (
        <Field label={`Cambio 1 ${instrument.currency} = ? ${currency}`} htmlFor={`${id}-fx`}>
          <Input id={`${id}-fx`} inputMode="decimal" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder="BCE del giorno" />
        </Field>
      ) : null}
    </>
  );
  const controvalore = (
    <p className="text-sm text-muted-foreground">
      {grossValue !== null && instrument ? (
        <>
          Controvalore <span className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(grossValue, instrument.currency)}</span>
        </>
      ) : null}
    </p>
  );
  const saveLabel = editing ? (save.isPending ? "Salvataggio…" : "Salva modifiche") : save.isPending ? "Registrazione…" : "Registra operazione";

  if (editing) {
    return (
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogSections>
          <DialogSection title="Operazione" icon={ArrowLeftRightIcon} color="var(--swatch-indigo)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {typeField}
              {dateField}
            </div>
            {instrumentField}
          </DialogSection>
          <DialogSection title="Importi" icon={CoinsIcon} color="var(--swatch-amber)" description={type === "split" ? SPLIT_RATIO_HINT : undefined}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {amountFields}
              {costFields}
            </div>
          </DialogSection>
        </DialogSections>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogActions>
          {controvalore}
          <Button type="submit" disabled={save.isPending || !instrument}>
            {saveLabel}
          </Button>
        </DialogActions>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <StepProgress index={flow.index} count={flow.count} label="Passi della nuova operazione" />
      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-4">
        {flow.index === 0 ? (
          <>
            <StepHeading title="Che operazione è?" description="Scegli il tipo e lo strumento." />
            {typeField}
            {instrumentField}
          </>
        ) : null}
        {flow.index === 1 ? (
          <>
            <StepHeading title="Quando e quanto?" description={type === "split" ? SPLIT_RATIO_HINT : instrument?.name} />
            {dateField}
            {amountFields}
            {flow.isLast ? controvalore : null}
          </>
        ) : null}
        {flow.index === 2 ? (
          <>
            <StepHeading title="Costi e imposte" description="Facoltativi: lascia 0 se non ci sono." />
            {costFields}
            {controvalore}
          </>
        ) : null}
      </StepStage>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <StepActions
        backLabel={flow.isFirst ? undefined : "Indietro"}
        onBack={() => {
          track("form_step_back", { flow: "operation", step: flow.index + 1 });
          setError(null);
          flow.back();
        }}
        primaryLabel={flow.isLast ? saveLabel : "Continua"}
        pending={save.isPending}
        disabled={flow.index === 0 && !instrument}
      />
    </form>
  );
}
