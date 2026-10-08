"use client";

/** Liquidità · Analisi: com'è andato il periodo (cifra, curva contro il solito), dove vanno i soldi, da dove arrivano, risparmio accumulato. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLineIcon, PieChartIcon, PiggyBankIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { LoadError } from "@/components/domain/shared";
import { MoneyHero } from "@/components/domain/net-worth";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import {
  CategoryDonut,
  LIQUIDITY_HREF,
  PeriodStepper,
  SectionTitle,
  SoftRow,
  TrendChart,
  liquidityFetchWindow,
  useLiquidity,
} from "@/components/domain/liquidity";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { computeAccumulatedSavings, computeIncomeSources } from "@/lib/calc/cashflow";
import {
  computeCategoryBreakdown,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  startOfDay,
} from "@/lib/calc/expenses";
import { computeMonthPace } from "@/lib/calc/month-pace";
import { getTrendRange } from "@/lib/calc/movements";
import { buildCumulativeSpend } from "@/lib/liquidity/spend-curve";
import { formatCurrency } from "@/lib/format";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import type { CategoryColor } from "@/lib/validation/categories";

/** Quante categorie compaiono come righe; il resto confluisce in "Altro". */
const TOP_CATEGORIES = 5;

export default function LiquiditaAnalisiPage() {
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
  const top = breakdown.slice(0, TOP_CATEGORIES);
  const otherAmount = breakdown.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.amount, 0);
  const slices = [
    ...top.map((c) => ({ key: c.categoryId, label: c.name, value: c.amount, color: SWATCH_CHART_COLOR[c.color as CategoryColor] ?? "var(--swatch-slate)" })),
    ...(otherAmount > 0 ? [{ key: "altro", label: "Altro", value: otherAmount, color: "var(--text-3)" }] : []),
  ];
  const sources = computeIncomeSources(scoped, categories, range);
  const savings = computeAccumulatedSavings(scoped, getTrendRange(period, referenceDate));
  const saved = savings.length > 0 ? savings[savings.length - 1].cumulative : 0;

  const delta = spent - spentBefore;
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const heaviest = top[0];
  const sentence =
    spent === 0
      ? "In questo periodo non ci sono ancora spese."
      : `${isCurrentMonth ? "Finora hai speso" : "Hai speso"} ${money(spent)}${spentBefore > 0 ? `, ${money(Math.abs(delta))} ${delta > 0 ? "in più" : "in meno"} del periodo prima` : ""}.${heaviest ? ` La voce che pesa di più è «${heaviest.name}», il ${Math.round((heaviest.amount / spent) * 100)}%.` : ""}`;

  if (isError) return <LoadError message="Impossibile caricare i dati dell'analisi." onRetry={() => refetch()} />;
  return (
    <div className="flex flex-col gap-8" aria-busy={isLoading}>
      <PeriodStepper period={period} onPeriodChange={setPeriod} referenceDate={referenceDate} onReferenceDateChange={setReferenceDate} latest={today} />
      <section aria-label="Spese del periodo">
        <p className="max-w-[62ch] text-lg leading-relaxed text-text-2 sm:text-xl">{sentence}</p>
        <p className="mt-6 text-base text-text-2">Spese del periodo</p>
        <MoneyHero value={spent} currency={currency} className="text-5xl leading-none tracking-tight sm:text-7xl" />
        {spentBefore > 0 && (
          <p className="mt-3 font-mono text-sm font-semibold tabular-nums" style={{ color: delta > 0 ? "var(--neg)" : "var(--pos)" }}>
            {delta > 0 ? "▲ +" : "▼ −"}
            {money(Math.abs(delta))} <span className="font-sans font-normal text-text-2">rispetto al periodo prima</span>
          </p>
        )}
        <div className="-mx-4 mt-2 sm:-mx-6">
          <TrendChart
            points={curve.map((p) => ({ label: p.date, value: p.value }))}
            reference={typical ?? undefined}
            description={`Spese cumulate: ${money(spent)}${typical ? `, contro ${money(typical[Math.max(curve.length - 1, 0)] ?? 0)} di solito a questo punto` : ""}.`}
            height={200}
          />
        </div>
        {typical && <p className="mt-2 text-sm text-text-2">La linea tratteggiata è la tua spesa media nello stesso tratto di mese.</p>}
      </section>
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-label="Dove vanno i soldi">
          <SectionTitle icon={PieChartIcon} title="Dove vanno i soldi" color="var(--swatch-teal)" />
          {slices.length === 0 ? (
            <p className="text-text-2">Nessuna spesa da mostrare in questo periodo.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <CategoryDonut slices={slices} currency={currency} centerLabel="di spese" />
              <ul className="flex min-w-60 flex-1 flex-col gap-1.5">
                {top.map((c) => (
                  <li key={c.categoryId}>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setCategoryId(c.categoryId);
                        router.push(LIQUIDITY_HREF);
                      }}
                    >
                      <SoftRow
                        start={<CategoryAvatar color={c.color as CategoryColor} icon={c.icon as never} size={17} className="size-10" />}
                        title={c.name}
                        hint={`${Math.round((c.amount / spent) * 100)}% delle spese · vedi i movimenti`}
                        end={<span className="font-heading font-semibold tabular-nums">{money(c.amount)}</span>}
                      />
                    </button>
                  </li>
                ))}
                {otherAmount > 0 && <SoftRow title="Altro" hint="Le categorie più piccole" end={<span className="font-heading font-semibold tabular-nums">{money(otherAmount)}</span>} />}
              </ul>
            </div>
          )}
        </section>
        <div className="flex flex-col gap-8">
          <section aria-label="Da dove arrivano">
            <SectionTitle icon={ArrowDownToLineIcon} title="Da dove arrivano" color="var(--pos)" />
            {sources.length === 0 ? (
              <p className="text-text-2">Nessuna entrata in questo periodo.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sources.map((s) => (
                  <SoftRow
                    key={s.categoryId}
                    title={s.name}
                    hint={s.quotaPct !== null ? `${Math.round(s.quotaPct)}% delle entrate` : undefined}
                    end={<span className="font-heading font-semibold tabular-nums text-pos">+{money(s.amount)}</span>}
                  />
                ))}
              </div>
            )}
          </section>
          <section aria-label="Risparmio accumulato">
            <SectionTitle icon={PiggyBankIcon} title="Risparmio accumulato" color="var(--swatch-blue)" />
            <SoftRow
              title={saved >= 0 ? "Messo da parte" : "In meno"}
              hint="Entrate meno spese, mese per mese, nei mesi guardati"
              end={<span className="font-heading font-semibold tabular-nums" style={{ color: saved >= 0 ? "var(--pos)" : "var(--neg)" }}>{saved >= 0 ? "+" : "−"}{money(Math.abs(saved))}</span>}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
