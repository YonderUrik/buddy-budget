"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Card di gestione delle regole di categorizzazione, montata sotto l'elenco categorie
 * in `/movimenti/categorie`. Elenca le regole esistenti (editabili inline, eliminabili con conferma)
 * e permette di aggiungerne una manualmente.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategorizationRulesQuery } from "@/lib/queries/categorization";
import type { Category } from "@/lib/db/schema/categories";
import { AddRuleForm } from "./add-rule-form";
import { LogoCredit } from "./logo-credit";
import { RuleRow } from "./rule-row";

export interface RulesManagerProps {
  categories: Category[];
}

export function RulesManager({ categories }: RulesManagerProps) {
  const { t: tr } = useLocalization();
  const { data: rules, isLoading, isError, refetch } = useCategorizationRulesQuery();
  const safeRules = rules ?? [];
  const [logosShown, setLogosShown] = React.useState(false);
  const onRemoteLogo = React.useCallback(() => setLogosShown(true), []);

  return (
    <Card className="p-0">
      <CardHeader className="border-b border-border px-4 py-4">
        <CardTitle className="text-base font-medium">{tr("Regole di categorizzazione")}</CardTitle>
        <p className="text-sm text-muted-foreground">{tr("Le regole si applicano da sole alle nuove transazioni. \"Contiene\" copre tutte le varianti: cambia")}{" "}<code className="text-xs">{tr("esselunga via roma")}</code>{" "}{tr("in")}{" "}
          <code className="text-xs">{tr("esselunga")}</code>{" "}{tr("per prendere ogni filiale.")}</p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-24 animate-pulse bg-muted p-4" aria-busy="true" />
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">{tr("Impossibile caricare le regole.")}{" "}
            <button onClick={() => refetch()} className="underline underline-offset-2">{tr("Riprova")}</button>
          </div>
        ) : safeRules.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{tr("Nessuna regola ancora. Le regole nascono quando categorizzi le transazioni dalla pagina Categorizza.")}</p>
        ) : (
          safeRules.map((rule) => <RuleRow key={rule.id} rule={rule} categories={categories} onRemoteLogo={onRemoteLogo} />)
        )}
        {categories.length > 0 && <AddRuleForm categories={categories} />}
        <LogoCredit visible={logosShown} className="px-4 pb-3" />
      </CardContent>
    </Card>
  );
}
