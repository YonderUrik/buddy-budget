"use client";

/**
 * Form per un nuovo conto manuale in due passi: prima nome e tipo, poi il saldo di oggi (con icona e colore, già
 * scelti di default). Errori per campo, annunciati agli screen reader; «Indietro» al primo passo esce dal form.
 */

import * as React from "react";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { useCreateAccountMutation } from "@/lib/queries/accounts";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";

const CUSTOM_TYPE_VALUE = "__custom__";

const FIELD_CLASS = "h-11 sm:h-9";

const DEFAULT_COLOR: AccountColor = "slate";
const DEFAULT_ICON: AccountIcon = "wallet";

export interface AddAccountFormProps {
  /** Valuta dell'utente (ISO 4217), usata per CurrencyInput. */
  currency: string;
  /** Callback richiamata alla creazione con successo del conto. */
  onSuccess?: () => void;
  /** «Indietro» dal primo passo (es. tornare alla scelta del dialog). Senza, al primo passo non c'è «Indietro». */
  onExit?: () => void;
}

const ACCOUNT_FORM_STEPS = 2;

export function AddAccountForm({ currency, onSuccess, onExit }: AddAccountFormProps) {
  const flow = useStepFlow(ACCOUNT_FORM_STEPS);
  const idBase = React.useId();
  const createMutation = useCreateAccountMutation();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<string>(ACCOUNT_TYPE_OPTIONS[0]);
  const [isCustomType, setIsCustomType] = React.useState(false);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(0);
  const [color, setColor] = React.useState<AccountColor>(DEFAULT_COLOR);
  const [icon, setIcon] = React.useState<AccountIcon>(DEFAULT_ICON);
  const [errors, setErrors] = React.useState<{ name?: string; type?: string; balance?: string; form?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!flow.isLast) {
      if (name.trim() === "") next.name = "Dai un nome al conto, per riconoscerlo nell'elenco.";
      if (type.trim() === "") next.type = "Scrivi di che tipo di conto si tratta.";
      setErrors(next);
      if (next.name || next.type) {
        document.getElementById(`${idBase}-${next.name ? "name" : "type-custom"}`)?.focus();
        return;
      }
      track("form_step_completed", { flow: "account_manual", step: flow.index + 1 });
      flow.next();
      return;
    }
    if (balanceValue === null) next.balance = "Inserisci il saldo di oggi (anche 0).";
    setErrors(next);
    if (next.balance || balanceValue === null) {
      document.getElementById(`${idBase}-balance`)?.focus();
      return;
    }

    createMutation.mutate(
      { name: name.trim(), type: type.trim(), balance: balanceValue, color, icon },
      {
        onSuccess: () => {
          setName("");
          setType(ACCOUNT_TYPE_OPTIONS[0]);
          setIsCustomType(false);
          setBalanceValue(0);
          setColor(DEFAULT_COLOR);
          setIcon(DEFAULT_ICON);
          onSuccess?.();
        },
        onError: (mutationError) => setErrors({ form: mutationError.message }),
      }
    );
  }

  function handleBack() {
    track("form_step_back", { flow: "account_manual", step: flow.index + 1 });
    setErrors({});
    if (flow.isFirst) onExit?.();
    else flow.back();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <StepProgress index={flow.index} count={flow.count} label="Passi del nuovo conto" />

      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-5">
        {flow.index === 0 ? (
          <>
            <StepHeading title="Come si chiama il conto?" />
            <Field id={`${idBase}-name`} label="Nome del conto" error={errors.name}>
              <Input
                id={`${idBase}-name`}
                data-autofocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Conto Intesa"
                autoComplete="off"
                maxLength={80}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${idBase}-name-error` : undefined}
                className={FIELD_CLASS}
              />
            </Field>

            <Field id={`${idBase}-type`} label="Tipo" error={errors.type}>
              <Select
                value={isCustomType ? CUSTOM_TYPE_VALUE : type}
                onValueChange={(value) => {
                  if (value === CUSTOM_TYPE_VALUE) {
                    setIsCustomType(true);
                    setType("");
                    return;
                  }
                  setIsCustomType(false);
                  setType(value as string);
                }}
              >
                <SelectTrigger id={`${idBase}-type`} className={cn("w-full", FIELD_CLASS)}>
                  <SelectValue placeholder="Seleziona il tipo di conto" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_TYPE_VALUE}>Altro…</SelectItem>
                </SelectContent>
              </Select>
              {isCustomType && (
                <Input
                  id={`${idBase}-type-custom`}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Es. Cassa contanti, Wallet crypto"
                  aria-label="Tipo di conto personalizzato"
                  aria-invalid={errors.type ? true : undefined}
                  aria-describedby={errors.type ? `${idBase}-type-error` : undefined}
                  className={cn("mt-1.5", FIELD_CLASS)}
                />
              )}
            </Field>
          </>
        ) : (
          <>
            <StepHeading title="Quanto c'è sul conto oggi?" description="Da qui in poi lo aggiornano i movimenti che registri." />
            <Field id={`${idBase}-balance`} label="Saldo di oggi" error={errors.balance}>
              <CurrencyInput
                id={`${idBase}-balance`}
                data-autofocus
                value={balanceValue}
                onChange={setBalanceValue}
                currency={currency}
                className={cn("w-full text-lg font-medium", FIELD_CLASS)}
                aria-label="Saldo di oggi"
              />
            </Field>
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <AccountIconColorPicker
                value={{ color, icon }}
                onChange={({ color: c, icon: i }) => {
                  setColor(c);
                  setIcon(i);
                }}
              >
                <div className="transition-transform hover:scale-105">
                  <AccountAvatar color={color} icon={icon} size={20} className="size-10 shadow-sm" />
                </div>
              </AccountIconColorPicker>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{name.trim() || "Il tuo conto"}</p>
                <p className="text-xs text-muted-foreground">Tocca l&apos;icona per cambiare icona e colore (facoltativo).</p>
              </div>
            </div>
          </>
        )}
      </StepStage>

      <StepActions
        backLabel={flow.isFirst && !onExit ? undefined : "Indietro"}
        onBack={handleBack}
        primaryLabel={flow.isLast ? (createMutation.isPending ? "Aggiungo il conto…" : "Aggiungi il conto") : "Continua"}
        pending={createMutation.isPending}
      />

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** Campo con etichetta visibile collegata al controllo, suggerimento e messaggio d'errore annunciato (`role="alert"`). */
function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="-mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
