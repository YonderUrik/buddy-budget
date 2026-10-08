"use client";

/**
 * Secondo passo di "Aggiungi debito": i dati del finanziamento. Se l'utente ne lascia vuoto uno tra capitale, rata, rate e
 * tasso, lo calcoliamo noi e lo diciamo chiaramente; sotto compare l'anteprima del piano.
 */

import * as React from "react";
import { CalculatorIcon, EyeIcon, InfoIcon, ReceiptIcon, TagIcon } from "lucide-react";
import { DialogActions, DialogSection, DialogSections } from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
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
import { formatCurrency } from "@/lib/format";
import type { LoanInputKey } from "@/lib/calc/amortization";
import { AddDebtCostsField } from "./add-debt-costs-field";
import { DebtFormField } from "./debt-form-field";
import { formatMonthYear } from "./debts-format";

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

function formatCalculated(key: LoanInputKey, value: number, currency: string): string {
  if (key === "annualRate") return `${value.toFixed(2).replace(".", ",")}%`;
  if (key === "installments") return String(value);
  return formatCurrency(value, currency);
}

/** Valore da mostrare nel campo vuoto che è stato calcolato (testo segnaposto). */
function placeholderFor(key: LoanInputKey, calculated: LoanInputKey | undefined, value: number | undefined): string {
  if (calculated !== key || value === undefined) return "";
  return String(Math.round(value * 100) / 100).replace(".", ",").replace(TRAILING_ZEROS, "$1").replace(/[.,]$/, "");
}

export interface AddDebtDetailsFormProps {
  state: AddDebtFormState;
  onChange: (state: AddDebtFormState) => void;
  currency: string;
  onBack: () => void;
  onCreated: () => void;
}

export function AddDebtDetailsForm({ state, onChange, currency, onBack, onCreated }: AddDebtDetailsFormProps) {
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
    const basics = validateAddFormBasics(state);
    if (basics) return setError(basics);
    if (!resolved) return setError(resolution.ok ? null : (resolution.message ?? "Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso"));
    setError(null);
    mutation.mutate(buildCreateDebtInput(state, resolved, todayIso()), { onSuccess: onCreated, onError: (e) => setError(e.message) });
  }

  const calc = resolved?.calculated;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogSections>
        <DialogSection title="Il finanziamento" icon={TagIcon}>
          <div className="grid grid-cols-2 gap-3">
            <DebtFormField label="Nome" htmlFor={`${id}-name`}>
              <Input id={`${id}-name`} placeholder="Es. Prestito auto" value={state.name} onChange={(e) => set({ name: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={copy.firstDate} htmlFor={`${id}-date`}>
              <Input id={`${id}-date`} type="date" value={state.firstInstallmentDate} onChange={(e) => set({ firstInstallmentDate: e.target.value })} />
            </DebtFormField>
          </div>
        </DialogSection>

        <DialogSection
          title="I dati che conosci"
          icon={CalculatorIcon}
          description={
            <>
              Compila quelli che hai. <strong className="font-medium text-foreground">Se te ne manca uno, lascialo vuoto</strong>: lo calcoliamo dagli altri tre.
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <DebtFormField label={copy.principal} htmlFor={`${id}-principal`}>
              <Input id={`${id}-principal`} inputMode="decimal" value={state.principal} placeholder={resolved ? placeholderFor("principal", calc, resolved.inputs.principal) : ""} onChange={(e) => set({ principal: e.target.value })} />
            </DebtFormField>
            <DebtFormField label="Rata mensile" htmlFor={`${id}-installment`}>
              <Input id={`${id}-installment`} inputMode="decimal" value={state.installment} placeholder={resolved ? placeholderFor("installment", calc, resolved.inputs.installment) : ""} onChange={(e) => set({ installment: e.target.value })} />
            </DebtFormField>
            <DebtFormField label={copy.installments} htmlFor={`${id}-installments`}>
              <Input id={`${id}-installments`} inputMode="numeric" value={state.installments} placeholder={resolved ? placeholderFor("installments", calc, resolved.inputs.installments) : ""} onChange={(e) => set({ installments: e.target.value })} />
            </DebtFormField>
            <DebtFormField label="Tasso annuo (TAN, %)" htmlFor={`${id}-rate`}>
              <Input id={`${id}-rate`} inputMode="decimal" value={state.annualRate} placeholder={resolved ? placeholderFor("annualRate", calc, resolved.inputs.annualRate) : ""} onChange={(e) => set({ annualRate: e.target.value })} />
            </DebtFormField>
          </div>
          {resolved && calc ? (
            <p className="flex items-start gap-2 text-sm text-foreground" role="status">
              <InfoIcon size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Abbiamo calcolato {CALCULATED_LABELS[calc]}: <strong className="font-medium">{formatCalculated(calc, resolved.inputs[calc], currency)}</strong>. Può differire di poco da quello della banca, per gli arrotondamenti.
              </span>
            </p>
          ) : null}
          {!resolution.ok && resolution.message ? <p className="text-sm text-neg" role="alert">{resolution.message}</p> : null}
        </DialogSection>

        <DialogSection>
          <details open={state.costs.length > 0} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                <ReceiptIcon className="size-3.5" />
              </span>
              Spese accessorie <span className="font-normal text-muted-foreground">(facoltativo)</span>
            </summary>
            <div className="mt-3">
              <AddDebtCostsField costs={state.costs} onChange={(costs) => set({ costs })} />
            </div>
          </details>
        </DialogSection>

        {preview && resolved ? (
          <DialogSection title="Anteprima del piano" icon={EyeIcon}>
            <dl className="grid grid-cols-3 gap-3 text-sm" aria-label="Anteprima del piano">
              <div>
                <dt className="text-xs text-muted-foreground">Rata</dt>
                <dd className="font-heading font-medium tabular-nums">{formatCurrency(preview.installment, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Finisce a</dt>
                <dd className="font-heading font-medium">{formatMonthYear(preview.endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{resolved.apr !== null ? "Interessi · TAEG" : "Interessi totali"}</dt>
                <dd className="font-heading font-medium tabular-nums">
                  {formatCurrency(preview.totalInterest, currency, { maximumFractionDigits: 0 })}
                  {resolved.apr !== null ? ` · ${resolved.apr.toFixed(2).replace(".", ",")}%` : ""}
                </dd>
              </div>
            </dl>
          </DialogSection>
        ) : null}
      </DialogSections>

      {error ? <p className="text-sm text-neg" role="alert">{error}</p> : null}
      <DialogActions>
        <Button type="button" variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvo…" : "Aggiungi debito"}
        </Button>
      </DialogActions>
    </form>
  );
}
