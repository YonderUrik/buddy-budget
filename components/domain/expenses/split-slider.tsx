"use client";

/**
 * UI "Dividi": ripartisce l'importo di una transazione (spesa o entrata) tra quota effettiva e quota esclusa dal conteggio.
 * Scorciatoie (niente, metà, un terzo, un quarto), importo libero e cursore; la barra mostra subito quanto resta tuo.
 * Si salva a ogni scelta; `onClose`, se presente, viene chiamato dopo il salvataggio.
 */

import * as React from "react";
import { SplitIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { track } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import { cn } from "@/lib/utils";
import { clampExcluded, computeSplitExcluded } from "./split-slider.utils";

/** Scorciatoie di divisione: `parts` quote uguali, di cui una resta come spesa effettiva (0 = nessuna divisione). */
const SPLIT_SHORTCUTS = [
  { parts: 0, label: "Niente", mode: "niente" },
  { parts: 2, label: "½", mode: "meta" },
  { parts: 3, label: "⅓", mode: "terzo" },
  { parts: 4, label: "¼", mode: "quarto" },
] as const;

type SplitMode = (typeof SPLIT_SHORTCUTS)[number]["mode"] | "libero";

export interface SplitSliderProps {
  transaction: Transaction;
  currency: string;
  onClose?: () => void;
  className?: string;
}

export function SplitSlider({ transaction, currency, onClose, className }: SplitSliderProps) {
  const updateMutation = useUpdateTransactionMutation();
  const totalAmount = Math.abs(Number(transaction.amount));
  const isIncome = Number(transaction.amount) > 0;
  const [excluded, setExcluded] = React.useState(Math.abs(Number(transaction.excludedAmount)));
  const [spentInput, setSpentInput] = React.useState(() => (totalAmount - excluded).toFixed(2));
  const spent = totalAmount - excluded;
  const spentShare = totalAmount > 0 ? (spent / totalAmount) * 100 : 100;
  const spentLabel = isIncome ? "Entrata effettiva" : "Tua spesa";

  function commit(value: number, mode: SplitMode) {
    if (value === Math.abs(Number(transaction.excludedAmount))) {
      onClose?.();
      return;
    }
    updateMutation.mutate(
      { id: transaction.id, input: { excludedAmount: value } },
      {
        onSuccess: () => {
          track("transaction_split_mode", { mode });
          onClose?.();
        },
      }
    );
  }

  function applySplit(parts: number, mode: SplitMode) {
    const value = parts === 0 ? 0 : computeSplitExcluded(totalAmount, parts);
    setExcluded(value);
    setSpentInput((totalAmount - value).toFixed(2));
    commit(value, mode);
  }

  function commitSpentInput() {
    if (spentInput.trim() === "") {
      setSpentInput((totalAmount - excluded).toFixed(2));
      return;
    }
    const nextSpent = clampExcluded(Number(spentInput), totalAmount);
    const value = clampExcluded(totalAmount - nextSpent, totalAmount);
    setSpentInput((totalAmount - value).toFixed(2));
    if (value === excluded) return;
    setExcluded(value);
    commit(value, "libero");
  }

  const idPrefix = `dividi-${transaction.id}`;

  return (
    <section
      aria-label="Dividi"
      className={cn("flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
          <SplitIcon className="size-4 text-primary" aria-hidden="true" />
          Dividi
        </h3>
        <p className="text-xs text-muted-foreground">Quanto è davvero {isIncome ? "un'entrata" : "tua spesa"}?</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {isIncome
          ? "Escludi dal conteggio la parte che non è reddito reale: rimborsi, giroconti, storni."
          : "Escludi dal conteggio la parte che non è tua spesa: quote di altri, rimborsi, giroconti."}
      </p>

      <div role="group" aria-label="Scorciatoie di divisione" className="grid grid-cols-5 gap-1.5">
        {SPLIT_SHORTCUTS.map(({ parts, label, mode }) => {
          const active = parts === 0 ? excluded === 0 : Math.abs(excluded - computeSplitExcluded(totalAmount, parts)) < 0.005;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              disabled={updateMutation.isPending}
              onClick={() => applySplit(parts, mode)}
              className={cn(
                "flex h-11 items-center justify-center rounded-full border border-border bg-card text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60",
                active && "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {label}
            </button>
          );
        })}
        <label htmlFor={`${idPrefix}-libero`} className="sr-only">
          {spentLabel} (importo libero)
        </label>
        <Input
          id={`${idPrefix}-libero`}
          type="number"
          inputMode="decimal"
          min={0}
          max={totalAmount}
          step={0.01}
          disabled={updateMutation.isPending}
          value={spentInput}
          onChange={(event) => setSpentInput(event.target.value)}
          onBlur={commitSpentInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-11 min-w-0 px-2 text-center text-sm"
        />
      </div>

      <div
        role="img"
        aria-label={`${spentLabel} ${formatCurrency(spent, currency)}, esclusa dal conteggio ${formatCurrency(excluded, currency)}`}
        className="flex h-8 overflow-hidden rounded-lg text-xs font-semibold"
      >
        <span
          className="flex items-center justify-center bg-primary text-primary-foreground transition-[width]"
          style={{ width: `${spentShare}%` }}
        >
          {spentShare > 18 ? (isIncome ? "Reddito" : "Tua") : ""}
        </span>
        <span className="flex flex-1 items-center justify-center border border-border bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)] text-muted-foreground">
          {spentShare < 82 ? "Esclusa" : ""}
        </span>
      </div>

      <Slider
        aria-label="Quota esclusa dal conteggio"
        value={[excluded]}
        min={0}
        max={totalAmount}
        step={0.01}
        disabled={updateMutation.isPending}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          setExcluded(next);
          setSpentInput((totalAmount - next).toFixed(2));
        }}
        onValueCommitted={(value) => commit(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount), "libero")}
      />

      <dl className="flex justify-between gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">{spentLabel}</dt>
          <dd className="font-heading text-xl font-medium tabular-nums text-foreground">{formatCurrency(spent, currency)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Esclusa dal conteggio</dt>
          <dd className="font-heading text-xl font-medium tabular-nums text-muted-foreground">{formatCurrency(excluded, currency)}</dd>
        </div>
      </dl>
      {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
      {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
    </section>
  );
}
