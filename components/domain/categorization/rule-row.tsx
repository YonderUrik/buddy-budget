"use client";

/**
 * Riga singola di `RulesManager`: pattern e categoria/tipo match editabili inline
 * (salvataggio su blur o Enter, come il budget di `CategoryLegendRow`), eliminazione
 * con conferma via `AlertDialog`.
 */

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategoryAvatar } from "@/components/domain/categories";
import { useDeleteRuleMutation, useUpdateRuleMutation } from "@/lib/queries/categorization";
import type { CategorizationRuleWithCategoryName } from "@/lib/queries/categorization";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { RULE_MATCH_TYPE_LABELS, RULE_SOURCE_LABELS } from "./rule-labels";

export interface RuleRowProps {
  rule: CategorizationRuleWithCategoryName;
  categories: Category[];
}

export function RuleRow({ rule, categories }: RuleRowProps) {
  const updateMutation = useUpdateRuleMutation();
  const deleteMutation = useDeleteRuleMutation();

  const [pattern, setPattern] = React.useState(rule.pattern);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const category = categories.find((c) => c.id === rule.categoryId);
  // La fallback ("Da categorizzare") non è mai una categoria valida per una regola: una regola che vi
  // punti resta sempre "usata 0 volte" a runtime (`selectMatchingRule` la scarta) e, se creata su
  // suggerimento della UI di revisione, intrappolerebbe quel merchant nel fallback per sempre.
  const assignableCategories = categories.filter((c) => !c.isFallback);

  function commitPattern() {
    const trimmed = pattern.trim();
    if (trimmed === "" || trimmed === rule.pattern) {
      setPattern(rule.pattern);
      return;
    }
    updateMutation.mutate(
      { id: rule.id, input: { pattern: trimmed } },
      { onError: () => setPattern(rule.pattern) }
    );
  }

  function commitCategory(categoryId: string | null) {
    if (categoryId === null || categoryId === rule.categoryId) return;
    updateMutation.mutate({ id: rule.id, input: { categoryId } });
  }

  function commitMatchType(matchType: string | null) {
    if (matchType === null || matchType === rule.matchType) return;
    updateMutation.mutate({ id: rule.id, input: { matchType: matchType as "merchant" | "contains" } });
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(rule.id, { onSuccess: () => setConfirmOpen(false) });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {category && (
          <CategoryAvatar
            color={category.color as CategoryColor}
            icon={category.icon as CategoryIcon}
            size={14}
            className="size-7"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onBlur={commitPattern}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-7 w-full text-sm font-medium"
            aria-label="Pattern della regola"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={rule.matchType} onValueChange={commitMatchType}>
              <SelectTrigger size="sm" className="h-6 w-fit text-xs">
                <SelectValue>
                  {(value: "merchant" | "contains") => RULE_MATCH_TYPE_LABELS[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merchant">Esatta</SelectItem>
                <SelectItem value="contains">Contiene</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rule.categoryId} onValueChange={commitCategory}>
              <SelectTrigger size="sm" className="h-6 w-fit text-xs">
                <SelectValue>{() => category?.name ?? "—"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {assignableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {RULE_SOURCE_LABELS[rule.source]}
        </Badge>
        <span className="text-xs text-muted-foreground">usata {rule.hitCount} volte</span>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Elimina regola"
          >
            <Trash2 size={14} />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare questa regola?</AlertDialogTitle>
              <AlertDialogDescription>
                Il pattern &quot;{rule.pattern}&quot; non verrà più applicato automaticamente alle nuove
                transazioni.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
