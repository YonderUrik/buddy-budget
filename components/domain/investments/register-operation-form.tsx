"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

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
import { type Instrument } from "@/lib/db/schema/investments";
import { INVESTMENT_TRANSACTION_TYPES, type InvestmentTransactionType } from "@/lib/investments/constants";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";

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
import { ErrorWithReport } from "@/components/domain/support";

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
  /** The price was written by the user (a sentence in «Cerca»): it wins over the market price of the date. */
  priceFromUser?: boolean;
  /** Name to search when no instrument is known yet (the picker opens with it). */
  instrumentQuery?: string;
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
  /** Instruments held today, offered by the picker before typing. */
  heldInstruments?: Instrument[];
  /** Se presente, il form salva le modifiche di questa operazione invece di registrarne una nuova. */
  editing?: EditingOperation;
  onSuccess?: () => void;
}

function roundCents(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

export function RegisterOperationForm({ currency, initial, heldInstruments = [], editing, onSuccess }: RegisterOperationFormProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr, language } = useLocalization();
  const id = React.useId();
  const create = useCreateInvestmentTransactionMutation();
  const update = useUpdateInvestmentTransactionMutation();
  const save = editing ? update : create;
  const [instrument, setInstrument] = React.useState<Instrument | null>(initial?.instrument ?? null);
  const [type, setType] = React.useState<InvestmentTransactionType>(initial?.type ?? "acquisto");
  const [date, setDate] = React.useState(initial?.date ?? localTodayKey());
  const [quantity, setQuantity] = React.useState(numberText(initial?.quantity, formattingLocale));
  // null = il campo segue il prezzo proposto; una stringa = valore scritto dall'utente.
  // In modifica parte dal prezzo salvato, non da quello di mercato della data.
  const [priceInput, setPriceInput] = React.useState<string | null>(editing || initial?.priceFromUser ? numberText(initial?.price, formattingLocale) : null);
  const [gross, setGross] = React.useState(numberText(roundCents(initial?.grossAmount), formattingLocale));
  const [fees, setFees] = React.useState(numberText(initial?.fees, formattingLocale));
  const [taxes, setTaxes] = React.useState(numberText(roundCents(initial?.taxes), formattingLocale));
  const [fxRate, setFxRate] = React.useState(numberText(initial?.fxRate, formattingLocale));
  const [error, setError] = React.useState<string | null>(null);

  const fields = fieldsFor(type);
  const stepCount = editing ? 1 : fields.costs ? 3 : 2;
  const flow = useStepFlow(stepCount);
  const needsFx = fields.costs && instrument !== null && instrument.currency !== currency;
  const suggestPrice = fields.price && suggestsMarketPrice(type);
  const priceOnDate = useInstrumentPriceOnDateQuery(suggestPrice ? (instrument?.id ?? null) : null, date);
  const suggested = suggestPrice && priceOnDate.data?.price ? priceText(priceOnDate.data.price.close, formattingLocale) : null;
  // Senza prezzo alla data resta quello di partenza (es. l'ultimo prezzo stimato).
  const price = priceInput ?? suggested ?? numberText(initial?.price, formattingLocale);
  const priceHint = suggestPrice && instrument ? priceSuggestionHint(date, priceOnDate.data, priceOnDate.isFetching, language) : null;
  const grossValue = computeGrossValue(type, parseAmount(quantity, formattingLocale), parseAmount(price, formattingLocale), parseAmount(gross, formattingLocale), instrument?.priceUnit);

  function chooseInstrument(next: Instrument) {
    setInstrument(next);
    // Il prezzo scritto per un altro strumento non vale per questo.
    setPriceInput(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!instrument) return setError(tr("Scegli uno strumento"));
    if (!flow.isLast) {
      if (flow.index === 1 && fields.quantity && !(parseAmount(quantity, formattingLocale) ?? 0)) return setError(type === "split" ? tr("Scrivi il rapporto dello split.") : tr("Scrivi la quantità."));
      track("form_step_completed", { flow: "operation", step: flow.index + 1 });
      flow.next();
      return;
    }
    const input = {
      type,
      date,
      quantity: fields.quantity ? (parseAmount(quantity, formattingLocale) ?? 0) : 0,
      price: fields.price ? (parseAmount(price, formattingLocale) ?? 0) : 0,
      grossAmount: fields.grossAmount ? parseAmount(gross, formattingLocale) : null,
      fees: fields.costs ? (parseAmount(fees, formattingLocale) ?? 0) : 0,
      taxes: fields.costs ? (parseAmount(taxes, formattingLocale) ?? 0) : 0,
      ...(needsFx && parseAmount(fxRate, formattingLocale) ? { fxRate: parseAmount(fxRate, formattingLocale)! } : {}),
    };
    const callbacks = { onSuccess: () => onSuccess?.(), onError: (e: Error) => setError(e.message) };
    if (editing) update.mutate({ id: editing.id, input: { ...input, note: editing.note } }, callbacks);
    else create.mutate({ ...input, instrumentId: instrument.id }, callbacks);
  }

  const typeField = (
    <Field label={tr("Tipo")}>
      <Select value={type} onValueChange={(v) => v && setType(v as InvestmentTransactionType)}>
        <SelectTrigger className="w-full" aria-label={tr("Tipo di operazione")}>
          <SelectValue>{(v: string | null) => (v ? tr(TRANSACTION_TYPE_LABELS[v as InvestmentTransactionType]) : "")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {INVESTMENT_TRANSACTION_TYPES.filter((t) => t !== "rettifica").map((t) => (
            <SelectItem key={t} value={t}>
              {tr(TRANSACTION_TYPE_LABELS[t])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
  const dateField = (
    <Field label={tr("Data")} htmlFor={`${id}-date`}>
      <Input id={`${id}-date`} type="date" value={date} max={localTodayKey()} onChange={(e) => setDate(e.target.value)} />
    </Field>
  );
  const instrumentField = (
    <Field label={tr("Strumento")}>
      {editing ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">{instrument?.name ?? tr("Strumento")}</p>
      ) : (
        <InstrumentPicker value={instrument} onChange={chooseInstrument} defaultCurrency={currency} suggestions={heldInstruments} initialQuery={initial?.instrumentQuery} />
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
          label={`${tr(priceLabel(instrument?.priceUnit))}${instrument ? ` (${instrument.currency})` : ""}`}
          value={price}
          onChange={setPriceInput}
          hint={priceHint}
          restoreValue={priceInput !== null && suggested !== null && parseAmount(priceInput, formattingLocale) !== parseAmount(suggested, formattingLocale) ? suggested : null}
          onRestore={() => setPriceInput(null)}
        />
      ) : null}
      {fields.grossAmount ? (
        <Field label={tr("Importo lordo{0}", {0: instrument ? ` (${instrument.currency})` : ""})} htmlFor={`${id}-gross`}>
          <Input id={`${id}-gross`} inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
        </Field>
      ) : null}
    </>
  );
  const costFields = (
    <>
      {fields.costs ? (
        <>
          <Field label={tr("Commissioni ({0})", {0: currency})} htmlFor={`${id}-fees`}>
            <Input id={`${id}-fees`} data-autofocus={!editing ? "" : undefined} inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder={"0"} />
          </Field>
          <Field label={tr("Imposte trattenute ({0})", {0: currency})} htmlFor={`${id}-taxes`}>
            <Input id={`${id}-taxes`} inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} placeholder={"0"} />
          </Field>
        </>
      ) : null}
      {needsFx ? (
        <Field label={tr("Cambio 1 {0} = ? {1}", {0: instrument.currency, 1: currency})} htmlFor={`${id}-fx`}>
          <Input id={`${id}-fx`} inputMode="decimal" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder={tr("BCE del giorno")} />
        </Field>
      ) : null}
    </>
  );
  const controvalore = (
    <p className="text-sm text-muted-foreground">
      {grossValue !== null && instrument ? (
        <>{tr("Controvalore")}{" "}<span className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(grossValue, instrument.currency)}</span>
        </>
      ) : null}
    </p>
  );
  const saveLabel = editing ? (save.isPending ? tr("Salvataggio…") : tr("Salva modifiche")) : save.isPending ? "Registrazione…" : tr("Registra operazione");

  if (editing) {
    return (
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogSections>
          <DialogSection title={tr("Operazione")} icon={ArrowLeftRightIcon} color="var(--swatch-indigo)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {typeField}
              {dateField}
            </div>
            {instrumentField}
          </DialogSection>
          <DialogSection title={tr("Importi")} icon={CoinsIcon} color="var(--swatch-amber)" description={type === "split" ? SPLIT_RATIO_HINT : undefined}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {amountFields}
              {costFields}
            </div>
          </DialogSection>
        </DialogSections>
        {error ? <ErrorWithReport area="operazione" error={error} /> : null}
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
      <StepProgress index={flow.index} count={flow.count} label={tr("Passi della nuova operazione")} />
      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-4">
        {flow.index === 0 ? (
          <>
            <StepHeading title={tr("Che operazione è?")} description={tr("Scegli il tipo e lo strumento.")} />
            {typeField}
            {instrumentField}
          </>
        ) : null}
        {flow.index === 1 ? (
          <>
            <StepHeading title={tr("Quando e quanto?")} description={type === "split" ? tr(SPLIT_RATIO_HINT) : instrument?.name} />
            {dateField}
            {amountFields}
            {flow.isLast ? controvalore : null}
          </>
        ) : null}
        {flow.index === 2 ? (
          <>
            <StepHeading title={tr("Costi e imposte")} description={tr("Facoltativi: lascia 0 se non ci sono.")} />
            {costFields}
            {controvalore}
          </>
        ) : null}
      </StepStage>
      {error ? <ErrorWithReport area="operazione" error={error} /> : null}
      <StepActions
        backLabel={flow.isFirst ? undefined : tr("Indietro")}
        onBack={() => {
          track("form_step_back", { flow: "operation", step: flow.index + 1 });
          setError(null);
          flow.back();
        }}
        primaryLabel={flow.isLast ? saveLabel : tr("Continua")}
        pending={save.isPending}
        disabled={flow.index === 0 && !instrument}
      />
    </form>
  );
}
