"use client";

/** Form "+ Aggiungi" spesa: crea una transazione manuale su uno dei conti manuali dell'utente. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/domain/accounts";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useCreateTransactionMutation } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";

export interface AddTransactionFormProps {
  categories: Category[];
  currency: string;
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AddTransactionForm({ categories, currency }: AddTransactionFormProps) {
  const { data: accounts } = useAccountsQuery();
  const manualAccounts = (accounts ?? []).filter((account) => account.source === "manuale");
  const createMutation = useCreateTransactionMutation();

  const [accountIdOverride, setAccountIdOverride] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [categoryIdOverride, setCategoryIdOverride] = React.useState<string | null>(null);
  const [amountValue, setAmountValue] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayDateString());
  const [error, setError] = React.useState<string | null>(null);

  // Preseleziona il primo conto/categoria disponibile finché l'utente non sceglie esplicitamente.
  const accountId = accountIdOverride ?? manualAccounts[0]?.id ?? "";
  const categoryId = categoryIdOverride ?? categories[0]?.id ?? "";

  const canSubmit =
    accountId !== "" &&
    description.trim() !== "" &&
    categoryId !== "" &&
    amountValue !== null &&
    amountValue > 0 &&
    date !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError("Serve almeno un conto manuale per registrare una spesa");
      return;
    }
    if (description.trim() === "" || !categoryId) {
      setError("Descrizione e categoria sono obbligatorie");
      return;
    }
    if (amountValue === null || amountValue <= 0) {
      setError("L'importo non è valido");
      return;
    }

    createMutation.mutate(
      { accountId, description: description.trim(), categoryId, amount: amountValue, date },
      {
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setDate(todayDateString());
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Conto</label>
        <Select
          value={accountId}
          onValueChange={(value) => {
            if (value === null) return;
            setAccountIdOverride(value);
          }}
          disabled={manualAccounts.length === 0}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Conto" />
          </SelectTrigger>
          <SelectContent>
            {manualAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-description">
          Descrizione
        </label>
        <Input
          id="new-transaction-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Categoria</label>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            if (value === null) return;
            setCategoryIdOverride(value);
          }}
          disabled={categories.length === 0}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-amount">
          Importo
        </label>
        <CurrencyInput
          value={amountValue}
          onChange={setAmountValue}
          currency={currency}
          className="w-full sm:w-28"
          aria-label="Importo"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground" htmlFor="new-transaction-date">
          Data
        </label>
        <Input
          id="new-transaction-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-36"
        />
      </div>

      <Button type="submit" disabled={!canSubmit || createMutation.isPending} className="w-full sm:w-auto">
        {createMutation.isPending ? "Aggiunta in corso..." : "+ Aggiungi"}
      </Button>

      {manualAccounts.length === 0 && (
        <p className="w-full text-sm text-muted-foreground">
          Serve almeno un conto manuale per registrare una spesa: aggiungine uno dalla schermata Conti.
        </p>
      )}

      {categories.length === 0 && (
        <p className="w-full text-sm text-muted-foreground">
          Nessuna categoria disponibile: aggiungine una prima di registrare una spesa.
        </p>
      )}

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
