"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Passi di dettaglio di "Aggiungi debito" (nome e data, dati del finanziamento, spese e conferma). Se l'utente ne lascia vuoto uno tra capitale, rata, rate e
 * tasso, lo calcoliamo noi e lo diciamo chiaramente; sotto compare l'anteprima del piano.
 */

import * as React from "react";
import { InfoIcon, ReceiptIcon } from "lucide-react";
import { StepActions, StepHeading } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import {
  buildCreateDebtInput,
  previewAddForm,
  resolveAddForm,
  validateAddFormBasics,
  type AddDebtFormState,
} from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import { useCreateDebtMutation } from "@/lib/queries/debts";

import type { LoanInputKey } from "@/lib/calc/amortization";
import { AddDebtCostsField } from "./add-debt-costs-field";
import { DebtFormField } from "./debt-form-field";
import { localizedDebtFormats } from "./debts-format";
import { ErrorWithReport } from "@/components/domain/support";

interface FieldCopy {
  principal: string;
  installments: string;
  firstDate: string;
}

const FIELD_COPY: Record<"nuovo" | "origine" | "fotografia", FieldCopy> = {
  nuovo: { principal: "Capitale", installments: "Numero di rate", firstDate: "Prima rata" },
  origine: { principal: "Capitale erogato", installments: "Numero di rate totali", firstDate: "Data della prima rata" },
  fotografia: { principal: "Residuo di oggi", installments: "Rate rimanenti", firstDate: "Prossima rata" },
};

const CALCULATED_LABELS: Record<LoanInputKey, string> = {
  principal: "il capitale",
  installment: "la rata",
  installments: "il numero di rate",
  annualRate: "il tasso",
};

const TRAILING_ZEROS = /([.,]\d*?)0+$/;



/** Valore da mostrare nel campo vuoto che è stato calcolato (testo segnaposto). */
function placeholderFor(key: LoanInputKey, calculated: LoanInputKey | undefined, value: number | undefined): string {
  if (calculated !== key || value === undefined) return "";
  return String(Math.round(value * 100) / 100).replace(".", ",").replace(TRAILING_ZEROS, "$1").replace(/[.,]$/, "");
}

export interface AddDebtDetailsFormProps {
  state: AddDebtFormState;
  onChange: (state: AddDebtFormState) => void;
  currency: string;
  /** Quale passo di dettaglio mostrare: 0 nome e data, 1 dati, 2 spese e anteprima. */
  part: number;
  onNext: () => void;
  onBack: () => void;
  onCreated: () => void;
}

export function AddDebtDetailsForm({ state, onChange, currency, part, onNext, onBack, onCreated }: AddDebtDetailsFormProps) {
  const { formatMonthYear } = localizedDebtFormats(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  function formatCalculated(key: LoanInputKey, value: number, currency: string): string {
  if (key === "annualRate") return `${value.toFixed(2).replace(".", ",")}%`;
  if (key === "installments") return String(value);
  return formatCurrency(value, currency);
}

  const { t: tr } = useLocalization();
  const mutation = useCreateDebtMutation();
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const copy = FIELD_COPY[state.startMode];
  const resolution = resolveAddForm(state);
  const resolved = resolution.ok ? resolution.value : null;
  const preview = resolved ? previewAddForm(state, resolved) : null;
  const set = (patch: Partial<AddDebtFormState>) => onChange({ ...state, ...patch });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (part === 0) {
      if (state.name.trim() === "") return setError(tr("Dai un nome al debito, per riconoscerlo nell'elenco."));
      setError(null);
      return onNext();
    }
    if (part === 1) {
      if (!resolved) return setError(resolution.ok ? null : (resolution.message ?? "Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso"));
      setError(null);
      return onNext();
    }
    const basics = validateAddFormBasics(state);
    if (basics) return setError(basics);
    if (!resolved) return setError(resolution.ok ? null : (resolution.message ?? "Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso"));
    setError(null);
    mutation.mutate(buildCreateDebtInput(state, resolved, todayIso()), { onSuccess: onCreated, onError: (e) => setError(e.message) });
  }

  const calc = resolved?.calculated;
  const last = part === 2;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {part === 0 ? (
        <>
          <StepHeading title={tr("Come si chiama il finanziamento?")} description={tr("Il nome serve a riconoscerlo nell'elenco; poi la data della {0}.", {0: copy.firstDate.toLowerCase()})} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DebtFormField label={tr("Nome")} htmlFor={`${id}-name`}>
              <Input id={`${id}-name`} placeholder={tr("Es. Prestito auto")} value={state.name} onChange={(e) => set({ name: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={copy.firstDate} htmlFor={`${id}-date`}>
              <Input id={`${id}-date`} type="date" value={state.firstInstallmentDate} onChange={(e) => set({ firstInstallmentDate: e.target.value })} />
            </DebtFormField>
          </div>
        </>
      ) : null}
      {part === 1 ? (
        <>
          <StepHeading title={tr("I dati che conosci")} description={tr("Compila quelli che hai. Se te ne manca uno, lascialo vuoto: lo calcoliamo dagli altri tre.")} />
          <div className="grid grid-cols-2 gap-3">
            <DebtFormField label={copy.principal} htmlFor={`${id}-principal`}>
              <Input id={`${id}-principal`} inputMode="decimal" value={state.principal} placeholder={resolved ? placeholderFor("principal", calc, resolved.inputs.principal) : ""} onChange={(e) => set({ principal: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={tr("Rata mensile")} htmlFor={`${id}-installment`}>
              <Input id={`${id}-installment`} inputMode="decimal" value={state.installment} placeholder={resolved ? placeholderFor("installment", calc, resolved.inputs.installment) : ""} onChange={(e) => set({ installment: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={copy.installments} htmlFor={`${id}-installments`}>
              <Input id={`${id}-installments`} inputMode="numeric" value={state.installments} placeholder={resolved ? placeholderFor("installments", calc, resolved.inputs.installments) : ""} onChange={(e) => set({ installments: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={tr("Tasso annuo (TAN, %)")} htmlFor={`${id}-rate`}>
              <Input id={`${id}-rate`} inputMode="decimal" value={state.annualRate} placeholder={resolved ? placeholderFor("annualRate", calc, resolved.inputs.annualRate) : ""} onChange={(e) => set({ annualRate: e.target.value })} />
            </DebtFormField>
          </div>
          {resolved && calc ? (
            <p className="flex items-start gap-2 text-sm text-foreground" role="status">
              <InfoIcon size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{tr("Abbiamo calcolato")}{" "}{tr(CALCULATED_LABELS[calc])}{":"}<strong className="font-medium">{formatCalculated(calc, resolved.inputs[calc], currency)}</strong>{tr(". Può differire di poco da quello della banca, per gli arrotondamenti.")}</span>
            </p>
          ) : null}
          {!resolution.ok && resolution.message ? <p className="text-sm text-neg" role="alert">{tr(resolution.message)}</p> : null}
        </>
      ) : null}
      {part === 2 ? (
        <>
          <StepHeading title={tr("Spese accessorie e conferma")} description={tr("Le spese sono facoltative; sotto vedi il piano che ne esce.")} />
          <details open={state.costs.length > 0} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                <ReceiptIcon className="size-3.5" />
              </span>{tr("Spese accessorie")}{" "}<span className="font-normal text-muted-foreground">{tr("(facoltativo)")}</span>
            </summary>
            <div className="mt-3">
              <AddDebtCostsField costs={state.costs} onChange={(costs) => set({ costs })} />
            </div>
          </details>
          {preview && resolved ? (
            <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{tr("Anteprima del piano")}</p>
            <dl className="grid grid-cols-3 gap-3 text-sm" aria-label={tr("Anteprima del piano")}>
              <div>
                <dt className="text-xs text-muted-foreground">{tr("Rata")}</dt>
                <dd className="font-heading font-medium tabular-nums">{formatCurrency(preview.installment, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{tr("Finisce a")}</dt>
                <dd className="font-heading font-medium">{formatMonthYear(preview.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{resolved.apr !== null ? tr("Interessi · TAEG") : tr("Interessi totali")}</dt>
                <dd className="font-heading font-medium tabular-nums">
                  {formatCurrency(preview.totalInterest, currency, { maximumFractionDigits: 0 })}
                  {resolved.apr !== null ? ` · ${new Intl.NumberFormat(formattingLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(resolved.apr)}%` : ""}
                </dd>
              </div>
            </dl>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <ErrorWithReport area="debito" error={error} /> : null}
      <StepActions backLabel={tr("Indietro")} onBack={onBack} primaryLabel={last ? (mutation.isPending ? "Salvo…" : "Aggiungi debito") : tr("Continua")} pending={mutation.isPending} />
    </form>
  );
}
