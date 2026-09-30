"use client";

/**
 * Card di gestione delle regole di categorizzazione, montata sotto l'elenco categorie
 * in `/movimenti/categorie`. Elenca le regole esistenti (editabili inline, eliminabili con conferma)
 * e permette di aggiungerne una manualmente.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategorizationRulesQuery } from "@/lib/queries/categorization";
import type { Category } from "@/lib/db/schema/categories";
import { AddRuleForm } from "./add-rule-form";
import { RuleRow } from "./rule-row";

export interface RulesManagerProps {
  categories: Category[];
}

export function RulesManager({ categories }: RulesManagerProps) {
  const { data: rules, isLoading, isError, refetch } = useCategorizationRulesQuery();
  const safeRules = rules ?? [];

  return (
    <Card className="p-0">
      <CardHeader className="border-b border-border px-4 py-4">
        <CardTitle className="text-base font-medium">Regole di categorizzazione</CardTitle>
        <p className="text-sm text-muted-foreground">
          Le regole si applicano da sole alle nuove transazioni. &quot;Contiene&quot; copre tutte le
          varianti: cambia <code className="text-xs">esselunga via roma</code> in{" "}
          <code className="text-xs">esselunga</code> per prendere ogni filiale.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-24 animate-pulse bg-muted p-4" aria-busy="true" />
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">
            Impossibile caricare le regole.{" "}
            <button onClick={() => refetch()} className="underline underline-offset-2">
              Riprova
            </button>
          </div>
        ) : safeRules.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nessuna regola ancora. Le regole nascono quando categorizzi le transazioni dalla pagina
            Categorizza.
          </p>
        ) : (
          safeRules.map((rule) => <RuleRow key={rule.id} rule={rule} categories={categories} />)
        )}
        {categories.length > 0 && <AddRuleForm categories={categories} />}
      </CardContent>
    </Card>
  );
}
