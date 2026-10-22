"use client";

/**
 * Liquidità · Budget: what can still be spent this month within the budgets, category by category (with the leftover
 * carried from the months before and where the month is heading), the budgets the app proposes, and each budget's sheet.
 */

import * as React from "react";
import { BudgetHero, BudgetList, BudgetProposals, BudgetSheet, MonthStepper, type BudgetSheetTarget } from "@/components/domain/budget";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { useAcceptProposalsMutation, useBudgetMonthQuery } from "@/lib/queries/budgets";

export default function LiquiditaBudgetPage() {
  const { t: tr } = useLocalization();
  const [month, setMonth] = React.useState<string | undefined>(undefined);
  const [sheet, setSheet] = React.useState<{ kind: "budget" | "new"; categoryId: string } | null>(null);
  const { data: view, isLoading, isError, refetch } = useBudgetMonthQuery(month);
  const accept = useAcceptProposalsMutation();
  React.useEffect(() => track("liquidity_tab_viewed", { tab: "budget" }), []);

  if (isError) return <LoadError message={tr("Impossibile caricare i budget")} onRetry={() => refetch()} />;
  if (isLoading || !view) return <div className="h-96 max-w-3xl animate-pulse rounded-3xl bg-muted" aria-busy="true" />;

  const current = view.today.slice(0, 7);
  const target: BudgetSheetTarget | null = (() => {
    if (!sheet) return null;
    const budgeted = view.categories.find((c) => c.categoryId === sheet.categoryId);
    if (budgeted) return { kind: "budget", category: budgeted };
    const other = view.unbudgeted.find((c) => c.categoryId === sheet.categoryId);
    return other ? { kind: "new", category: other } : null;
  })();
  const hasBudgets = view.categories.length > 0;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <MonthStepper month={view.month} latest={current} onChange={(next) => setMonth(next === current ? undefined : next)} />
      {hasBudgets && <BudgetHero view={view} />}
      {view.proposals.length > 0 && (
        <BudgetProposals
          key={view.month}
          proposals={view.proposals}
          currency={view.currency}
          income={view.income?.amount ?? null}
          alreadyBudgeted={view.total.available}
          first={!hasBudgets}
          pending={accept.isPending}
          onAccept={(items) => accept.mutate({ items })}
        />
      )}
      {!hasBudgets && view.proposals.length === 0 && (
        <p className="max-w-[60ch] text-text-2">
          {view.when === "current"
            ? tr("Ti proporrò i budget appena avrai un mese intero di movimenti. Intanto puoi darne uno a una categoria qui sotto.")
            : tr("In questo mese non c'erano budget.")}
        </p>
      )}
      <BudgetList view={view} onOpen={(categoryId) => setSheet({ kind: "budget", categoryId })} onAdd={(categoryId) => setSheet({ kind: "new", categoryId })} />
      <BudgetSheet target={target} currency={view.currency} month={view.month} past={view.when === "past"} onClose={() => setSheet(null)} />
    </div>
  );
}
