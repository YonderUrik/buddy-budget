"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Messe dall'app»: le categorie applicate senza chiedere (regole e proposte sicure) che l'utente non ha ancora visto,
 * una riga per esercente. Si cambia una categoria toccandola; «Va tutto bene» toglie dalla lista quelle viste.
 */

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { AutoCategorizedGroup } from "@/lib/categorization/auto-review";
import type { Category } from "@/lib/db/schema/categories";
import { AutoCategorizedRow } from "./auto-categorized-row";
import { LogoCredit } from "@/components/domain/shared";

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
  const { t: tr } = useLocalization();
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-muted/50 p-8 text-center">
        <p className="font-heading text-lg font-medium text-foreground">{tr("Niente da controllare")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {autoApplyEnabled
            ? tr("Qui compaiono i movimenti a cui l'app ha messo la categoria da sola: con le tue regole o perché era quasi certa.")
            : tr("Qui compaiono i movimenti a cui l'app ha messo la categoria con le tue regole. In Impostazioni puoi lasciarla scegliere anche quando è quasi certa.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {total === 1 ? tr("1 movimento ha") : tr("{0} movimenti hanno", {0: total})}{" "}{tr("la categoria messa dall'app")}{autoApplyEnabled ? tr(", con le tue regole o perché era quasi certa") : tr(", con le tue regole")}{tr(". Se una non va, toccala e cambiala.")}</p>
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
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:-mb-6 sm:px-6">
        <p className="text-sm text-muted-foreground">{tr("Le hai guardate? Toglile dalla lista.")}</p>
        <Button type="button" onClick={onAllGood} disabled={allGoodPending} className="h-10 shrink-0 px-5 sm:h-9">
          <CheckIcon />{" "}{tr("Va tutto bene")}</Button>
      </div>
    </div>
  );
}
