"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Messe dall'app»: the categories applied without asking (rules, confident suggestions, bank categories) in the last 30 days,
 * one row per merchant. A history, not a to-do list: nothing waits for a confirmation, a category is changed by tapping it.
 */

import * as React from "react";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import { AUTO_CATEGORIZED_RECENT_DAYS, type AutoCategorizedGroup } from "@/lib/categorization/auto-review";
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
  autoApplyEnabled,
}: AutoCategorizedListProps) {
  const { t: tr } = useLocalization();
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-muted/50 p-8 text-center">
        <p className="font-heading text-lg font-medium text-foreground">{tr("Ancora niente qui")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {autoApplyEnabled
            ? tr("Qui compaiono i movimenti a cui l'app ha messo la categoria da sola: con le tue regole o perché era abbastanza sicura.")
            : tr("Qui compaiono i movimenti a cui l'app ha messo la categoria con le tue regole. In Impostazioni puoi lasciarla scegliere anche quando è abbastanza sicura.")}
        </p>
      </div>
    );
  }

  // The bank's file is named only when some of these rows took their category from it.
  const fromBank = groups.some((group) => group.source === "banca");
  const reasonText = autoApplyEnabled
    ? fromBank ? tr(", con le tue regole, con la categoria della banca o perché era abbastanza sicura") : tr(", con le tue regole o perché era abbastanza sicura")
    : fromBank ? tr(", con le tue regole o con la categoria della banca") : tr(", con le tue regole");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {tr("Negli ultimi {0} giorni,", {0: AUTO_CATEGORIZED_RECENT_DAYS})}{" "}{total === 1 ? tr("1 movimento ha") : tr("{0} movimenti hanno", {0: total})}{" "}{tr("la categoria messa dall'app")}{reasonText}{tr(". Non serve confermarle: se una non va, toccala e cambiala.")}</p>
      <ul className="flex flex-col">
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
    </div>
  );
}
