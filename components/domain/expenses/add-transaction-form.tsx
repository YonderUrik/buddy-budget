"use client";

/**
 * Form per registrare una spesa o un'entrata su un conto manuale. Importo e tipo in cima (è ciò che serve per primo),
 * errori accanto al campo, «Aggiungi e inserisci un altro» per più movimenti di fila. `stacked` per l'uso in un dialog.
 */

import * as React from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface AddTransactionFormProps {
  categories: Category[];
  currency: string;
  /** Layout verticale a tutta larghezza (per dialog). Default: riga orizzontale che va a capo. */
  stacked?: boolean;
  /** Chiamato dopo una creazione riuscita (es. per chiudere il dialog). */
  onSuccess?: () => void;
  /** Se presente, senza conti manuali il form offre di crearne uno al volo. */
  onAddAccount?: () => void;
}

type Direction = "spesa" | "entrata";
type FieldErrors = Partial<Record<"account" | "description" | "category" | "amount" | "date" | "form", string>>;

const DIRECTION_OPTIONS = [
  { value: "spesa", label: "Spesa" },
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

export function AddTransactionForm({ categories, currency, stacked = false, onSuccess, onAddAccount }: AddTransactionFormProps) {
  const idBase = React.useId();
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

  const availableCategories = categories.filter((c) => (direction === "entrata" ? c.type === "entrata" : c.type !== "entrata"));

  function handleDirectionChange(next: Direction) {
    setDirection(next);
    setCategoryIdOverride(null);
  }

  // Preseleziona il primo conto e la categoria più usata finché l'utente non sceglie esplicitamente.
  const accountId = accountIdOverride ?? manualAccounts[0]?.id ?? "";
  const categoryId = categoryIdOverride ?? pickDefaultCategoryId(availableCategories, categoryUsage ?? {});

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!accountId) next.account = "Serve un conto manuale su cui registrare il movimento.";
    if (amountValue === null || amountValue <= 0) next.amount = "Scrivi un importo maggiore di zero.";
    if (description.trim() === "") next.description = "Scrivi una breve descrizione, per ritrovarlo nell'elenco.";
    if (!categoryId) next.category = "Scegli una categoria.";
    if (date === "") next.date = "Scegli la data del movimento.";
    setErrors(next);
    const first = (["amount", "description", "category", "date"] as const).find((key) => next[key]);
    if (first === "amount") amountRef.current?.querySelector("input")?.focus();
    if (first === "description" || first === "date") document.getElementById(`${idBase}-${first}`)?.focus();
    return Object.keys(next).length === 0;
  }

  function submit(keepOpen: boolean) {
    if (!validate() || amountValue === null) return;
    createMutation.mutate(
      { accountId, description: description.trim(), categoryId, amount: amountValue, date },
      {
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setCategoryIdOverride(null);
          setErrors({});
          if (keepOpen) {
            setAdded((count) => count + 1);
            amountRef.current?.querySelector("input")?.focus();
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

  const fieldClass = stacked ? "flex w-full min-w-0 flex-col gap-1.5" : "flex w-full min-w-0 flex-col gap-1.5 sm:w-auto";
  const controlWidth = (smWidth: string) => (stacked ? "w-full" : `w-full ${smWidth}`);
  const pending = createMutation.isPending;
  const noAccount = manualAccounts.length === 0 && accounts !== undefined;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(false); }}
      noValidate
      className={stacked ? "flex flex-col gap-4" : "flex flex-wrap items-end gap-3 border-t border-border p-4"}
    >
      <div className={fieldClass}>
        <SegmentedControl options={DIRECTION_OPTIONS} value={direction} onChange={handleDirectionChange} ariaLabel="Tipo di movimento" stretch={stacked} />
      </div>

      <div className={fieldClass}>
        <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-amount`}>Importo</label>
        <div ref={amountRef}>
          <CurrencyInput
            id={`${idBase}-amount`}
            value={amountValue}
            onChange={setAmountValue}
            currency={currency}
            className={cn(controlWidth("sm:w-28"), FIELD_CLASS, stacked && "text-lg font-medium")}
            aria-label="Importo"
          />
        </div>
        <FieldError id={`${idBase}-amount-error`} message={errors.amount} />
      </div>

      <div className={fieldClass}>
        <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-description`}>Descrizione</label>
        <Input
          id={`${idBase}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={direction === "entrata" ? "Es. Stipendio di ottobre" : "Es. Spesa al supermercato"}
          autoComplete="off"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `${idBase}-description-error` : undefined}
          className={cn(controlWidth("sm:w-40"), FIELD_CLASS)}
        />
        <FieldError id={`${idBase}-description-error`} message={errors.description} />
      </div>

      <div className={fieldClass}>
        <span className="text-sm font-medium text-foreground">Categoria</span>
        <CategoryPicker
          categories={availableCategories}
          value={categoryId}
          onValueChange={setCategoryIdOverride}
          usage={categoryUsage}
          disabled={availableCategories.length === 0}
          aria-label="Categoria"
          className={cn(controlWidth("sm:w-48"), FIELD_CLASS)}
        />
        <FieldError id={`${idBase}-category-error`} message={errors.category} />
      </div>

      <div className={fieldClass}>
        <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-account`}>Conto</label>
        <Select
          value={accountId}
          onValueChange={(value) => {
            if (value === null) return;
            setAccountIdOverride(value);
          }}
          disabled={manualAccounts.length === 0}
        >
          <SelectTrigger id={`${idBase}-account`} className={cn(controlWidth("sm:w-40"), FIELD_CLASS)}>
            <SelectValue placeholder="Scegli il conto">
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

      <div className={fieldClass}>
        <label className="text-sm font-medium text-foreground" htmlFor={`${idBase}-date`}>Data</label>
        <div className="flex items-center gap-2">
          <Input
            id={`${idBase}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={errors.date ? true : undefined}
            className={cn(controlWidth("sm:w-36"), FIELD_CLASS)}
          />
          {stacked ? (
            <>
              <QuickDate label="Oggi" active={date === todayDateString()} onClick={() => setDate(todayDateString())} />
              <QuickDate label="Ieri" active={date === yesterdayDateString()} onClick={() => setDate(yesterdayDateString())} />
            </>
          ) : null}
        </div>
        <FieldError id={`${idBase}-date-error`} message={errors.date} />
      </div>

      {noAccount ? (
        <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          I movimenti si registrano sui conti manuali, e non ne hai ancora uno.
          {onAddAccount ? <button type="button" onClick={onAddAccount} className="min-h-11 cursor-pointer font-medium text-primary hover:underline">Aggiungi un conto</button> : null}
        </p>
      ) : null}

      {availableCategories.length === 0 && (
        <p className="w-full text-sm text-muted-foreground">
          {direction === "entrata"
            ? "Nessuna categoria di entrata disponibile: aggiungine una dalla scheda Categorie e regole."
            : "Nessuna categoria disponibile: aggiungine una prima di registrare una spesa."}
        </p>
      )}

      <div className={cn("flex gap-2", stacked ? "flex-col-reverse sm:flex-row sm:justify-end" : "w-full sm:w-auto")}>
        {stacked ? (
          <Button type="button" variant="outline" disabled={pending || noAccount} onClick={() => submit(true)} className="h-11 cursor-pointer sm:h-9">
            Aggiungi e inserisci un altro
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || noAccount} className={cn("cursor-pointer", stacked ? "h-11 sm:h-9" : "w-full sm:w-auto")}>
          {pending ? "Aggiungo…" : "Aggiungi"}
        </Button>
      </div>

      <p role="status" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", added === 0 && "sr-only")}>
        {added > 0 ? <><CheckCircle2Icon className="size-4 text-pos" aria-hidden="true" /> {added === 1 ? "Movimento aggiunto." : `${added} movimenti aggiunti.`} Puoi inserirne un altro.</> : null}
      </p>
      {errors.form ? <p role="alert" className="text-sm text-destructive">{errors.form}</p> : null}
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-sm text-destructive">{message}</p>;
}

function QuickDate({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
      {label}
    </button>
  );
}
