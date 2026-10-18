"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Liquidità · Analisi: com'è andato il periodo (cifra, curva contro il solito), dove vanno i soldi, da dove arrivano, risparmio accumulato. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLineIcon, PieChartIcon, PiggyBankIcon } from "lucide-react";
import { LoadError } from "@/components/domain/shared";
import { MoneyHero } from "@/components/domain/net-worth";
import {
  LIQUIDITY_HREF,
  PeriodStepper,
  SectionTitle,
  SoftRow,
  SpendByGroup,
  TrendChart,
  liquidityFetchWindow,
  useLiquidity,
  type SpendGroup,
} from "@/components/domain/liquidity";
import { track } from "@/lib/analytics";
import { EXPENSE_GROUP_KEYS, GROUP_DISPLAY, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";
import { authClient } from "@/lib/auth/client";
import { computeAccumulatedSavings, computeIncomeSources } from "@/lib/calc/cashflow";
import {
  computeCategoryBreakdown,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  scaleBudgetForPeriod,
  startOfDay,
} from "@/lib/calc/expenses";
import { computeMonthPace } from "@/lib/calc/month-pace";
import { getTrendRange } from "@/lib/calc/movements";
import { buildCumulativeSpend } from "@/lib/liquidity/spend-curve";

import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

export default function LiquiditaAnalisiPage() {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { period, setPeriod, referenceDate, setReferenceDate, today: now, accountId, setCategoryId } = useLiquidity();
  const today = React.useMemo(() => startOfDay(now), [now]);

  React.useEffect(() => track("liquidity_tab_viewed", { tab: "analisi" }), []);

  const { from, to } = liquidityFetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const categoriesQuery = useCategoriesQuery();
  const categories = React.useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const budgetsQuery = useBudgetsQuery();
  const budgets = React.useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const scoped = React.useMemo(() => filterTransactions(transactions ?? [], { categoryId: null, searchText: "", accountId }), [transactions, accountId]);

  const range = getPeriodRange(period, referenceDate);
  const previous = getPreviousPeriodRange(period, referenceDate);
  const spent = computeSummary(scoped, range).speseEffettive;
  const spentBefore = computeSummary(scoped, previous).speseEffettive;
  const curve = React.useMemo(() => buildCumulativeSpend(scoped, range, today), [scoped, range, today]);
  const isCurrentMonth = period === "mese" && range.from.getTime() <= today.getTime() && today.getTime() <= range.to.getTime();
  const typical = React.useMemo(() => (isCurrentMonth ? computeMonthPace(scoped, budgets, today).typical : null), [isCurrentMonth, scoped, budgets, today]);

  const breakdown = React.useMemo(
    () => computeCategoryBreakdown(scoped.filter(isExpense), categories, period, referenceDate, today).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
    [scoped, categories, period, referenceDate, today]
  );
  const heaviest = breakdown[0];
  // Monthly budgets scaled to the period on screen (a year shows twelve months of budget).
  const budgetById = React.useMemo(
    () => new Map(budgets.filter((b) => Number(b.monthlyAmount) > 0).map((b) => [b.categoryId, scaleBudgetForPeriod(Number(b.monthlyAmount), period)])),
    [budgets, period]
  );
  const groups = React.useMemo<SpendGroup[]>(
    () =>
      ([...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY] as CategoryGroupKey[])
        .map((key) => {
          const items = breakdown.filter((c) => c.group === key);
          return {
            key,
            label: GROUP_DISPLAY[key].label,
            color: GROUP_DISPLAY[key].colorVar,
            amount: items.reduce((sum, c) => sum + c.amount, 0),
            categories: items.map((c) => ({ id: c.categoryId, name: c.name, color: c.color, icon: c.icon, amount: c.amount, budget: budgetById.get(c.categoryId) })),
          };
        })
        .filter((g) => g.amount > 0)
        .sort((x, y) => y.amount - x.amount),
    [breakdown, budgetById]
  );
  const sources = computeIncomeSources(scoped, categories, range);
  const savings = computeAccumulatedSavings(scoped, getTrendRange(period, referenceDate));
  const saved = savings.length > 0 ? savings[savings.length - 1].cumulative : 0;

  const delta = spent - spentBefore;
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const sentence =
    spent === 0
      ? tr("In questo periodo non ci sono ancora spese.")
      : `${isCurrentMonth ? tr("Finora hai speso") : tr("Hai speso")} ${money(spent)}${spentBefore > 0 ? tr(", {0} {1} del periodo prima", { 0: money(Math.abs(delta)), 1: delta > 0 ? tr("in più") : tr("in meno") }) : ""}.${heaviest ? tr(" La voce che pesa di più è «{0}», il {1}.", { 0: heaviest.name, 1: new Intl.NumberFormat(formattingLocale, { style: "percent", maximumFractionDigits: 0 }).format(heaviest.amount / spent) }) : ""}`;

  if (isError) return <LoadError message={tr("Impossibile caricare i dati dell'analisi.")} onRetry={() => refetch()} />;
  return (
    <div className="flex flex-col gap-8" aria-busy={isLoading}>
      <PeriodStepper period={period} onPeriodChange={setPeriod} referenceDate={referenceDate} onReferenceDateChange={setReferenceDate} latest={today} />
      <section aria-label={tr("Spese del periodo")}>
        <p className="max-w-[62ch] text-lg leading-relaxed text-text-2 sm:text-xl">{sentence}</p>
        <p className="mt-6 text-base text-text-2">{tr("Spese del periodo")}</p>
        <MoneyHero value={spent} currency={currency} className="text-5xl leading-none tracking-tight sm:text-7xl" />
        {spentBefore > 0 && (
          <p className="mt-3 text-sm font-semibold tabular-nums" style={{ color: delta > 0 ? "var(--neg)" : "var(--pos)" }}>
            {delta > 0 ? "▲ +" : "▼ −"}
            {money(Math.abs(delta))}{" "}<span className="font-sans font-normal text-text-2">{tr("rispetto al periodo prima")}</span>
          </p>
        )}
        <div className="-mx-4 mt-2 sm:-mx-6">
          <TrendChart
            points={curve.map((p) => ({ label: p.date, value: p.value }))}
            reference={typical ?? undefined}
            description={tr("Spese cumulate: {0}{1}.", {0: money(spent), 1: typical ? `, contro ${money(typical[Math.max(curve.length - 1, 0)] ?? 0)} di solito a questo punto` : ""})}
            height={200}
            formatValue={money}
            referenceLabel="Di solito"
          />
        </div>
        {typical && <p className="mt-2 text-sm text-text-2">{tr("La linea tratteggiata è la tua spesa media nello stesso tratto di mese.")}</p>}
      </section>
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-label={tr("Dove vanno i soldi")}>
          <SectionTitle
            icon={PieChartIcon}
            title={tr("Dove vanno i soldi")}
            color="var(--swatch-teal)"
            href={`${LIQUIDITY_HREF}/categorie`}
            linkLabel={budgetById.size > 0 ? "Modifica i budget" : "Imposta un budget"}
          />
          {groups.length === 0 ? (
            <p className="text-text-2">{tr("Nessuna spesa da mostrare in questo periodo.")}</p>
          ) : (
            <SpendByGroup
              groups={groups}
              currency={currency}
              onPickCategory={(id) => {
                setCategoryId(id);
                router.push(LIQUIDITY_HREF);
              }}
            />
          )}
        </section>
        <div className="flex flex-col gap-8">
          <section aria-label={tr("Da dove arrivano")}>
            <SectionTitle icon={ArrowDownToLineIcon} title={tr("Da dove arrivano")} color="var(--pos)" />
            {sources.length === 0 ? (
              <p className="text-text-2">{tr("Nessuna entrata in questo periodo.")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sources.map((s) => (
                  <SoftRow
                    key={s.categoryId}
                    title={s.name}
                    hint={s.quotaPct !== null ? tr("{0}% delle entrate", {0: Math.round(s.quotaPct)}) : undefined}
                    end={<span className="font-heading font-semibold tabular-nums text-pos">{"+"}{money(s.amount)}</span>}
                  />
                ))}
              </div>
            )}
          </section>
          <section aria-label={tr("Risparmio accumulato")}>
            <SectionTitle icon={PiggyBankIcon} title={tr("Risparmio accumulato")} color="var(--swatch-blue)" />
            <SoftRow
              title={saved >= 0 ? tr("Messo da parte") : tr("In meno")}
              hint={tr("Entrate meno spese, mese per mese, nei mesi guardati")}
              end={<span className="font-heading font-semibold tabular-nums" style={{ color: saved >= 0 ? "var(--pos)" : "var(--neg)" }}>{saved >= 0 ? "+" : "−"}{money(Math.abs(saved))}</span>}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
