"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Blocco "Fonti di entrata": una riga per categoria di tipo entrata, con importo e quota % sul totale entrate del periodo. */

import { CategoryAvatar } from "@/components/domain/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { IncomeSourceAmount } from "@/lib/calc/cashflow";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface IncomeSourcesListProps {
  sources: IncomeSourceAmount[];
  currency: string;
}

export function IncomeSourcesList({ sources, currency }: IncomeSourcesListProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{tr("Fonti di entrata")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {sources.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{tr("Nessuna entrata registrata in questo periodo.")}</p>
        ) : (
          sources.map((source) => (
            <div key={source.categoryId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <CategoryAvatar
                  color={source.color as CategoryColor}
                  icon={source.icon as CategoryIcon}
                  size={14}
                  className="size-7"
                />
                <p className="text-sm font-medium text-foreground">{source.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-pos">{formatCurrency(source.amount, currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {source.quotaPct === null ? "—" : tr("{0}% del totale", {0: Math.round(source.quotaPct)})}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
