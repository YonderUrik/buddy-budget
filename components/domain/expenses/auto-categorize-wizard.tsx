"use client";

/** Wizard sequenziale "Categorizza automaticamente": propone categoria e split per le transazioni "Da categorizzare" con match storico, una alla volta, con conferma esplicita per ciascuna. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CategoryAvatar } from "@/components/domain/categories";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { CategorizeSuggestion } from "@/lib/calc/categorize-suggestions";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { clampExcluded } from "./split-slider.utils";

interface AutoCategorizeStepProps {
  suggestion: CategorizeSuggestion;
  categories: Category[];
  currency: string;
  index: number;
  total: number;
  isPending: boolean;
  hasError: boolean;
  onSkip: () => void;
  onConfirm: (categoryId: string, excludedAmount: number) => void;
}

/** Chiave in `key` sul chiamante: un remount per ogni nuovo suggerimento resetta lo stato locale senza sincronizzazioni via effect. */
function AutoCategorizeStep({
  suggestion,
  categories,
  currency,
  index,
  total,
  isPending,
  hasError,
  onSkip,
  onConfirm,
}: AutoCategorizeStepProps) {
  const totalAmount = Math.abs(Number(suggestion.transaction.amount));
  const [categoryId, setCategoryId] = React.useState(suggestion.suggestedCategoryId);
  const [excluded, setExcluded] = React.useState(() =>
    clampExcluded((suggestion.suggestedSplitPercentage ?? 0) * totalAmount, totalAmount)
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Rivedi categorizzazione ({index + 1} di {total})
        </DialogTitle>
        <DialogDescription>
          Basato su {suggestion.matchCount} transazioni passate categorizzate così.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{suggestion.transaction.description}</p>
          <p className="text-xs text-muted-foreground">
            {suggestion.transaction.date} · {formatCurrency(totalAmount, currency)}
          </p>
        </div>

        <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>
              {(value: string) => {
                const selected = categories.find((c) => c.id === value);
                if (!selected) return "";
                return (
                  <span className="flex items-center gap-1.5">
                    <CategoryAvatar
                      color={selected.color as CategoryColor}
                      icon={selected.icon as CategoryIcon}
                      size={10}
                      className="size-4"
                    />
                    {selected.name}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-1.5">
                  <CategoryAvatar
                    color={category.color as CategoryColor}
                    icon={category.icon as CategoryIcon}
                    size={10}
                    className="size-4"
                  />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
          <Slider
            value={[excluded]}
            min={0}
            max={totalAmount}
            step={0.01}
            onValueChange={(value) =>
              setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
            <span>Esclusa: {formatCurrency(excluded, currency)}</span>
          </div>
        </div>

        {hasError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSkip} disabled={isPending}>
          Salta
        </Button>
        <Button type="button" onClick={() => onConfirm(categoryId, excluded)} disabled={isPending}>
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
      </DialogFooter>
    </>
  );
}

export interface AutoCategorizeWizardProps {
  suggestions: CategorizeSuggestion[];
  categories: Category[];
  currency: string;
  onClose: () => void;
}

export function AutoCategorizeWizard({ suggestions, categories, currency, onClose }: AutoCategorizeWizardProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [index, setIndex] = React.useState(0);
  const [appliedCount, setAppliedCount] = React.useState(0);

  const current = suggestions[index];
  const isDone = index >= suggestions.length;

  function handleConfirm(categoryId: string, excludedAmount: number) {
    if (!current) return;
    updateMutation.mutate(
      { id: current.transaction.id, input: { categoryId, excludedAmount } },
      {
        onSuccess: () => {
          setAppliedCount((n) => n + 1);
          setIndex((i) => i + 1);
        },
      }
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {isDone || !current ? (
          <>
            <DialogHeader>
              <DialogTitle>Categorizzazione completata</DialogTitle>
              <DialogDescription>
                Applicate {appliedCount} di {suggestions.length} transazioni.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Chiudi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <AutoCategorizeStep
            key={current.transaction.id}
            suggestion={current}
            categories={categories}
            currency={currency}
            index={index}
            total={suggestions.length}
            isPending={updateMutation.isPending}
            hasError={updateMutation.isError}
            onSkip={() => setIndex((i) => i + 1)}
            onConfirm={handleConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
