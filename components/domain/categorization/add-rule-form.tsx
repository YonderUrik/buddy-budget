"use client";

/** Form "+ Nuova regola": crea manualmente una regola di categorizzazione (pattern + categoria + tipo match). */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRuleMutation } from "@/lib/queries/categorization";
import type { Category } from "@/lib/db/schema/categories";
import { RULE_MATCH_TYPE_LABELS } from "./rule-labels";

export interface AddRuleFormProps {
  categories: Category[];
}

export function AddRuleForm({ categories }: AddRuleFormProps) {
  const createMutation = useCreateRuleMutation();
  // La fallback ("Da categorizzare") non è mai una categoria valida per una regola creata qui — vedi
  // lo stesso ragionamento in RuleRow: una regola sulla fallback resta sempre inutilizzata a runtime.
  const assignableCategories = React.useMemo(() => categories.filter((c) => !c.isFallback), [categories]);
  const [pattern, setPattern] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(assignableCategories[0]?.id ?? "");
  const [matchType, setMatchType] = React.useState<"merchant" | "contains">("contains");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pattern.trim() === "") {
      setError("Il pattern è obbligatorio");
      return;
    }
    if (categoryId === "") {
      setError("Seleziona una categoria");
      return;
    }

    createMutation.mutate(
      { pattern: pattern.trim(), categoryId, matchType },
      {
        onSuccess: () => {
          setPattern("");
          setMatchType("contains");
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-foreground" htmlFor="new-rule-pattern">
          Pattern
        </label>
        <Input
          id="new-rule-pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Es. esselunga"
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Tipo</label>
        <Select value={matchType} onValueChange={(value) => value && setMatchType(value as "merchant" | "contains")}>
          <SelectTrigger className="w-28">
            <SelectValue>{(value: "merchant" | "contains") => RULE_MATCH_TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="merchant">Esatta</SelectItem>
            <SelectItem value="contains">Contiene</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Categoria</label>
        <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {() => assignableCategories.find((c) => c.id === categoryId)?.name ?? "Seleziona"}
            </SelectValue>
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

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Aggiunta in corso..." : "Aggiungi regola"}
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
