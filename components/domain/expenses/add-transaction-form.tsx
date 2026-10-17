"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Form per registrare una spesa o un'entrata su un conto manuale, in due passi: importo e tipo, poi descrizione e
 * categoria; conto e data sono già precompilati (oggi, primo conto) e si cambiano da «Cambia». Errori accanto al campo, «Aggiungi e inserisci un altro» per più
 * movimenti di fila.
 */

import * as React from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/domain/accounts";
import { CategoryPicker } from "@/components/domain/categories";
import { SegmentedControl } from "@/components/domain/shared";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import { pickDefaultCategoryId } from "@/lib/categories/picker";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useCreateTransactionMutation } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema/categories";
import { ErrorWithReport } from "@/components/domain/support";

export interface AddTransactionFormProps {
  categories: Category[];
  currency: string;
  /** Chiamato dopo una creazione riuscita (es. per chiudere il dialog). */
  onSuccess?: () => void;
  /** Se presente, senza conti manuali il form offre di crearne uno al volo. */
  onAddAccount?: () => void;
}

type Direction = "spesa" | "entrata";
type FieldErrors = Partial<Record<"account" | "description" | "category" | "amount" | "date" | "form", string>>;

const DIRECTION_OPTIONS = [
  { value: "spesa", label: "Uscita" },
  { value: "entrata", label: "Entrata" },
] as const;

const FIELD_CLASS = "h-11 sm:h-9";
const MS_PER_DAY = 86_400_000;

function dateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayDateString(): string {
  return dateString(new Date());
}

function yesterdayDateString(): string {
  return dateString(new Date(Date.now() - MS_PER_DAY));
}

const TRANSACTION_STEPS = 2;

export function AddTransactionForm({ categories, currency, onSuccess, onAddAccount }: AddTransactionFormProps) {
  const { t: tr } = useLocalization();
  const idBase = React.useId();
  const flow = useStepFlow(TRANSACTION_STEPS);
  const { data: accounts } = useAccountsQuery();
  const manualAccounts = (accounts ?? []).filter((account) => account.source === "manuale");
  const createMutation = useCreateTransactionMutation();
  const { data: categoryUsage } = useCategoryUsageQuery();

  const [accountIdOverride, setAccountIdOverride] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<Direction>("spesa");
  const [description, setDescription] = React.useState("");
  const [categoryIdOverride, setCategoryIdOverride] = React.useState<string | null>(null);
  const [amountValue, setAmountValue] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayDateString());
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [added, setAdded] = React.useState(0);
  const amountRef = React.useRef<HTMLDivElement>(null);

  const availableCategories = categories.filter((c) => (c.type === "trasferimento" || (direction === "entrata" ? c.type === "entrata" : c.type !== "entrata")));

  function handleDirectionChange(next: Direction) {
    setDirection(next);
    setCategoryIdOverride(null);
  }

  // Preseleziona il primo conto e la categoria più usata finché l'utente non sceglie esplicitamente.
  const accountId = accountIdOverride ?? manualAccounts[0]?.id ?? "";
  const categoryId = categoryIdOverride ?? pickDefaultCategoryId(availableCategories, categoryUsage ?? {});

  /** Controlla i campi del passo `step`; porta il focus sul primo errore. */
  function validate(step: number): boolean {
    const next: FieldErrors = {};
    if (step === 0 && (amountValue === null || amountValue <= 0)) next.amount = "Scrivi un importo maggiore di zero.";
    if (step === 1) {
      if (description.trim() === "") next.description = "Scrivi una breve descrizione, per ritrovarlo nell'elenco.";
      if (!categoryId) next.category = "Scegli una categoria.";
      if (!accountId) next.account = "Serve un conto manuale su cui registrare il movimento.";
      if (date === "") next.date = "Scegli la data del movimento.";
    }
    setErrors(next);
    if (next.amount) amountRef.current?.querySelector("input")?.focus();
    if (next.description) document.getElementById(`${idBase}-description`)?.focus();
    if (next.date) document.getElementById(`${idBase}-date`)?.focus();
    return Object.keys(next).length === 0;
  }

  function submit(keepOpen: boolean) {
    if (!validate(1) || amountValue === null) return;
    createMutation.mutate(
      { accountId, description: description.trim(), categoryId, amount: amountValue, date, direction: direction === "entrata" ? "entrata" : "uscita" },
      {
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setCategoryIdOverride(null);
          setErrors({});
          track("form_step_completed", { flow: "transaction", step: TRANSACTION_STEPS });
          if (keepOpen) {
            setAdded((count) => count + 1);
            flow.goTo(0);
            return;
          }
          setDate(todayDateString());
          setDirection("spesa");
          setAdded(0);
          onSuccess?.();
        },
        onError: (mutationError) => setErrors({ form: mutationError.message }),
      }
    );
  }

  const pending = createMutation.isPending;
  const noAccount = manualAccounts.length === 0 && accounts !== undefined;
  const fieldClass = "flex w-full min-w-0 flex-col gap-1.5";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (flow.isLast) {
      submit(false);
      return;
    }
    if (!validate(flow.index)) return;
    track("form_step_completed", { flow: "transaction", step: flow.index + 1 });
    flow.next();
  }

  function handleBack() {
    track("form_step_back", { flow: "transaction", step: flow.index + 1 });
    setErrors({});
    flow.back();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <StepProgress index={flow.index} count={flow.count} label={tr("Passi del nuovo movimento")} />

      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-5">
        {flow.index === 0 ? (
          <>
            <StepHeading title={tr("Quanto è stato?")} />
            <SegmentedControl options={DIRECTION_OPTIONS} value={direction} onChange={handleDirectionChange} ariaLabel={tr("Tipo di movimento")} stretch />
            <div className={fieldClass}>
              <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-amount`}>{tr("Importo")}</label>
              <div ref={amountRef}>
                <CurrencyInput
                  id={`${idBase}-amount`}
                  data-autofocus
                  value={amountValue}
                  onChange={setAmountValue}
                  currency={currency}
                  className={cn("w-full text-lg font-medium", FIELD_CLASS)}
                  aria-label={tr("Importo")}
                />
              </div>
              <FieldError id={`${idBase}-amount-error`} message={errors.amount} />
            </div>
          </>
        ) : null}

        {flow.index === 1 ? (
          <>
            <StepHeading title={direction === "entrata" ? tr("Da dove arriva?") : tr("Per cosa è?")} />
            <div className={fieldClass}>
              <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-description`}>{tr("Descrizione")}</label>
              <Input
                id={`${idBase}-description`}
                data-autofocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={direction === "entrata" ? tr("Es. Stipendio di ottobre") : tr("Es. Spesa al supermercato")}
                autoComplete="off"
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? `${idBase}-description-error` : undefined}
                className={FIELD_CLASS}
              />
              <FieldError id={`${idBase}-description-error`} message={errors.description} />
            </div>
            <div className={fieldClass}>
              <span className="text-sm font-medium text-foreground">{tr("Categoria")}</span>
              <CategoryPicker
                categories={availableCategories}
                value={categoryId}
                onValueChange={setCategoryIdOverride}
                usage={categoryUsage}
                disabled={availableCategories.length === 0}
                aria-label={tr("Categoria")}
                className={cn("w-full", FIELD_CLASS)}
              />
              <FieldError id={`${idBase}-category-error`} message={errors.category} />
              {availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {direction === "entrata"
                    ? tr("Nessuna categoria di entrata disponibile: aggiungine una dalla scheda Categorie e regole.")
                    : tr("Nessuna categoria disponibile: aggiungine una prima di registrare una spesa.")}
                </p>
              ) : null}
            </div>
            <details className="rounded-xl bg-muted/50 p-3" open={Boolean(errors.account || errors.date) || noAccount}>
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {date === todayDateString() ? tr("Oggi") : date === yesterdayDateString() ? tr("Ieri") : date} {"·"}{manualAccounts.find((a) => a.id === accountId)?.name ?? tr("nessun conto")}
                </span>
                <span className="font-medium text-primary">{tr("Cambia")}</span>
              </summary>
              <div className="mt-3 flex flex-col gap-4">
            <div className={fieldClass}>
              <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-date`}>{tr("Data")}</label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${idBase}-date`}

                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={errors.date ? true : undefined}
                  className={cn("w-full", FIELD_CLASS)}
                />
                <QuickDate label={tr("Oggi")} active={date === todayDateString()} onClick={() => setDate(todayDateString())} />
                <QuickDate label={tr("Ieri")} active={date === yesterdayDateString()} onClick={() => setDate(yesterdayDateString())} />
              </div>
              <FieldError id={`${idBase}-date-error`} message={errors.date} />
            </div>
            <div className={fieldClass}>
              <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-account`}>{tr("Conto")}</label>
              <Select
                value={accountId}
                onValueChange={(value) => {
                  if (value === null) return;
                  setAccountIdOverride(value);
                }}
                disabled={manualAccounts.length === 0}
              >
                <SelectTrigger id={`${idBase}-account`} className={cn("w-full", FIELD_CLASS)}>
                  <SelectValue placeholder={tr("Scegli il conto")}>
                    {(value: string | null) => manualAccounts.find((a) => a.id === value)?.name ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {manualAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id={`${idBase}-account-error`} message={errors.account} />
            </div>
            {noAccount ? (
              <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{tr("I movimenti si registrano sui conti manuali, e non ne hai ancora uno.")}{onAddAccount ? <button type="button" onClick={onAddAccount} className="min-h-11 cursor-pointer font-medium text-primary hover:underline">{tr("Aggiungi un conto")}</button> : null}
              </p>
            ) : null}
                        </div>
            </details>
          </>
        ) : null}

      </StepStage>

      {flow.isLast ? (
        <Button type="button" variant="outline" disabled={pending || noAccount} onClick={() => submit(true)} className="h-11 cursor-pointer sm:h-9">{tr("Aggiungi e inserisci un altro")}</Button>
      ) : null}
      <StepActions
        backLabel={flow.isFirst ? undefined : tr("Indietro")}
        onBack={handleBack}
        primaryLabel={flow.isLast ? (pending ? "Aggiungo…" : "Aggiungi") : tr("Continua")}
        pending={pending}
        disabled={flow.isLast && noAccount}
      />

      <p role="status" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", added === 0 && "sr-only")}>
        {added > 0 ? <><CheckCircle2Icon className="size-4 text-pos" aria-hidden="true" />{" "}{added === 1 ? tr("Movimento aggiunto.") : tr("{0} movimenti aggiunti.", {0: added})}{" "}{tr("Puoi inserirne un altro.")}</> : null}
      </p>
      {errors.form ? <ErrorWithReport area="movimento" error={errors.form} /> : null}
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  const { t: tr } = useLocalization();
  if (!message) return null;
  return <p id={id} role="alert" className="text-sm text-destructive">{tr(message)}</p>;
}

function QuickDate({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { t: tr } = useLocalization();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors sm:min-h-9",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {tr(label)}
    </button>
  );
}
