"use client";

/**
 * «Fatte da sole»: le categorie applicate senza chiedere (regole e proposte sicure) che l'utente non ha ancora visto,
 * una riga per esercente. Si cambia una categoria toccandola; «Va tutto bene» toglie dalla lista quelle viste.
 */

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { AutoCategorizedGroup } from "@/lib/categorization/auto-review";
import { AUTO_APPLY_THRESHOLD } from "@/lib/categorization/suggest";
import { confidencePercent } from "@/lib/categorization/origin";
import type { Category } from "@/lib/db/schema/categories";
import { AutoCategorizedRow } from "./auto-categorized-row";
import { LogoCredit } from "./logo-credit";

export interface AutoCategorizedListProps {
  groups: AutoCategorizedGroup[];
  /** Movimenti in tutto (i gruppi ne raccolgono più d'uno). */
  total: number;
  categories: Category[];
  currency: string;
  categoryUsage?: CategoryUsageCounts;
  /** Gruppo di cui si sta salvando la correzione. */
  correctingKey?: string | null;
  onCorrect: (group: AutoCategorizedGroup, categoryId: string, remember: boolean) => void;
  /** «Va tutto bene»: segna come viste tutte le righe mostrate. */
  onAllGood: () => void;
  allGoodPending?: boolean;
  /** Le proposte sicure si applicano da sole (altrimenti qui finiscono solo le regole). */
  autoApplyEnabled: boolean;
}

export function AutoCategorizedList({
  groups,
  total,
  categories,
  currency,
  categoryUsage,
  correctingKey = null,
  onCorrect,
  onAllGood,
  allGoodPending = false,
  autoApplyEnabled,
}: AutoCategorizedListProps) {
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);
  const threshold = confidencePercent(AUTO_APPLY_THRESHOLD);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-border p-8 text-center">
        <p className="font-heading text-lg font-medium text-foreground">Niente da controllare</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {autoApplyEnabled
            ? `Qui compaiono i movimenti categorizzati da soli: dalle tue regole e dalle proposte sicure almeno al ${threshold}%.`
            : "Qui compaiono i movimenti categorizzati dalle tue regole. Attiva «Applica da sole le categorie sicure» per lasciare fare anche le proposte più sicure."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {total === 1 ? "1 movimento categorizzato" : `${total} movimenti categorizzati`} senza chiederti nulla, dalle tue regole
        {autoApplyEnabled ? ` e dalle proposte sicure almeno al ${threshold}%` : ""}. Se una categoria non va, toccala e
        cambiala.
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {groups.map((group) => (
          <AutoCategorizedRow
            key={group.groupKey}
            group={group}
            categories={categories}
            currency={currency}
            categoryUsage={categoryUsage}
            busy={correctingKey === group.groupKey}
            onCorrect={(categoryId, remember) => onCorrect(group, categoryId, remember)}
            onRemoteLogo={showLogoCredit}
          />
        ))}
      </ul>
      <LogoCredit visible={logosShown} />
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
        <p className="text-sm text-muted-foreground">Le hai guardate? Toglile dalla lista.</p>
        <Button type="button" onClick={onAllGood} disabled={allGoodPending} className="h-10 shrink-0 px-5 sm:h-9">
          <CheckIcon /> Va tutto bene
        </Button>
      </div>
    </div>
  );
}
