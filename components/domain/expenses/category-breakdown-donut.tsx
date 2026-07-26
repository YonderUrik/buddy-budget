"use client";

/**
 * Blocco "Per categoria": torta multilivello (layer interno tipo fissa/variabile, layer esterno categoria) e
 * legenda con budget mensile editabile, percentuale di saturazione budget e percentuale sul totale speso nel
 * periodo. Unifica il vecchio donut "Fisse vs variabili" e la lista budget separata in un'unica card. Il
 * salvataggio del budget avviene on-blur, stessa convenzione di add-account-form.tsx.
 */

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, Package } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { PieLabelRenderProps } from "recharts";
import { CategoryAvatar, ICON_MAP } from "@/components/domain/categories";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import { cn } from "@/lib/utils";
import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import {
  computeBudgetStats,
  LEGEND_SORT_DEFAULT_DIRECTION,
  sortCategoryAmounts,
  sortLegendEntries,
  type LegendEntry,
  type LegendSortCriterion,
  type LegendSortDirection,
} from "./category-breakdown-donut.utils";

const TYPE_CONFIG = {
  fissa: { label: "Fisse", color: "var(--chart-1)" },
  variabile: { label: "Variabili", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Soglia di saturazione oltre la quale il badge budget passa allo stile "sopra budget". */
const BUDGET_OVER_THRESHOLD_PCT = 100;

const LEGEND_SORT_OPTIONS: { value: LegendSortCriterion; label: string }[] = [
  { value: "percentuale", label: "% sul totale" },
  { value: "valore", label: "Valore speso" },
  { value: "budget", label: "% budget" },
  { value: "nome", label: "Nome" },
];

/** Soglia sotto la quale l'icona categoria non viene mostrata nella fetta (troppo piccola per essere leggibile). */
const PIE_ICON_MIN_PERCENT = 0.05;
/** Dimensione in px dell'icona categoria renderizzata dentro una fetta. */
const PIE_ICON_SIZE = 16;

/** Renderizza l'icona della categoria al centro radiale della sua fetta nell'anello esterno; nasconde l'icona sotto PIE_ICON_MIN_PERCENT. */
function renderCategoryIcon(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, payload } = props;
  if (percent === undefined || percent < PIE_ICON_MIN_PERCENT) return null;
  if (midAngle === undefined) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const icon = (payload as { icon?: CategoryIcon })?.icon;
  const Icon = icon ? (ICON_MAP[icon] ?? Package) : Package;

  return (
    <g transform={`translate(${x - PIE_ICON_SIZE / 2}, ${y - PIE_ICON_SIZE / 2})`}>
      <Icon size={PIE_ICON_SIZE} className="text-white" />
    </g>
  );
}

/** Formatta il valore del tooltip (nome + importo in valuta) al posto del default numerico di ChartTooltipContent. */
function tooltipValueFormatter(currency: string) {
  return function TooltipValue(value: ValueType | undefined, name: NameType | undefined) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(value), currency)}
        </span>
      </div>
    );
  };
}

export interface CategoryBreakdownDonutProps {
  categoryAmounts: CategoryAmount[];
  fixedVsVariable: FixedVsVariable;
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdownDonut({
  categoryAmounts,
  fixedVsVariable,
  budgets,
  currency,
}: CategoryBreakdownDonutProps) {
  const upsertMutation = useUpsertBudgetMutation();
  const [pendingCategoryId, setPendingCategoryId] = React.useState<string | null>(null);
  const [errorCategoryId, setErrorCategoryId] = React.useState<string | null>(null);
  const [sortCriterion, setSortCriterion] = React.useState<LegendSortCriterion>("percentuale");
  const [sortDirection, setSortDirection] = React.useState<LegendSortDirection>("desc");

  function handleCriterionChange(next: LegendSortCriterion) {
    setSortCriterion(next);
    setSortDirection(LEGEND_SORT_DEFAULT_DIRECTION[next]);
  }

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  /** Valida e invia il nuovo budget per una categoria. Ritorna false se il valore non è valido (nessuna mutation inviata). */
  function commitBudget(categoryId: string, raw: string): boolean {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return false;
    if (value === budgetFor(categoryId)) return true;

    setErrorCategoryId((prev) => (prev === categoryId ? null : prev));
    setPendingCategoryId(categoryId);
    upsertMutation.mutate(
      { categoryId, input: { monthlyAmount: value } },
      {
        onError: () => setErrorCategoryId(categoryId),
        onSuccess: () => setErrorCategoryId((prev) => (prev === categoryId ? null : prev)),
        onSettled: () => setPendingCategoryId((prev) => (prev === categoryId ? null : prev)),
      }
    );
    return true;
  }

  const sortedEntries = sortCategoryAmounts(categoryAmounts);
  const totalSpeso = categoryAmounts.reduce((sum, entry) => sum + entry.amount, 0);

  const enrichedEntries: LegendEntry[] = categoryAmounts.map((entry) => {
    const budgetAmount = budgetFor(entry.categoryId);
    const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
    return { ...entry, budgetAmount, saturazionePct, quotaPct };
  });
  const sortedLegendEntries = sortLegendEntries(enrichedEntries, sortCriterion, sortDirection);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = React.useState(false);
  const [canScrollDown, setCanScrollDown] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 2);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, sortedLegendEntries.length]);

  const innerData = [
    { key: "fissa", label: TYPE_CONFIG.fissa.label, value: fixedVsVariable.fissa, fill: "var(--color-fissa)" },
    {
      key: "variabile",
      label: TYPE_CONFIG.variabile.label,
      value: fixedVsVariable.variabile,
      fill: "var(--color-variabile)",
    },
  ];
  const outerData = sortedEntries
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      key: entry.categoryId,
      label: entry.name,
      value: entry.amount,
      fill: SWATCH_CHART_COLOR[entry.color as CategoryColor],
      icon: entry.icon as CategoryIcon,
    }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Per categoria
        </CardTitle>
        <CardAction className="flex items-center gap-1">
          <Select value={sortCriterion} onValueChange={(value) => handleCriterionChange(value as LegendSortCriterion)}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue>{(value: LegendSortCriterion) => LEGEND_SORT_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEGEND_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
            aria-label={sortDirection === "desc" ? "Ordina crescente" : "Ordina decrescente"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sortDirection === "desc" ? <ArrowDownIcon className="size-4" /> : <ArrowUpIcon className="size-4" />}
          </button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <ChartContainer config={TYPE_CONFIG} className="mx-auto aspect-square max-h-56 sm:mx-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Pie data={innerData} dataKey="value" nameKey="label" innerRadius={35} outerRadius={55}>
              {innerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Pie
              data={outerData}
              dataKey="value"
              nameKey="label"
              innerRadius={62}
              outerRadius={90}
              label={renderCategoryIcon}
              labelLine={false}
            >
              {outerData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="relative min-w-0">
          {/* Indicatori gradient fade: segnalano all'utente che la lista continua sopra/sotto */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 inset-x-0 z-10 h-6 bg-gradient-to-b from-card to-transparent transition-opacity duration-200",
              canScrollUp ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-0 inset-x-0 z-10 h-8 bg-gradient-to-t from-card to-transparent transition-opacity duration-200",
              canScrollDown ? "opacity-100" : "opacity-0"
            )}
          />

          <div
            ref={scrollRef}
            className="max-h-56 divide-y divide-border overflow-y-auto pr-1.5 custom-scrollbar"
          >
            {sortedLegendEntries.map((entry) => (
              <CategoryLegendRow
                key={entry.categoryId}
                entry={entry}
                budgetAmount={entry.budgetAmount}
                saturazionePct={entry.saturazionePct}
                quotaPct={entry.quotaPct}
                currency={currency}
                isSaving={pendingCategoryId === entry.categoryId}
                hasError={errorCategoryId === entry.categoryId}
                onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

}

interface CategoryLegendRowProps {
  entry: CategoryAmount;
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
  currency: string;
  /** True mentre il budget di questa categoria è in salvataggio. */
  isSaving: boolean;
  /** True se l'ultimo tentativo di salvataggio per questa categoria è fallito. */
  hasError: boolean;
  /** Valida e invia il nuovo valore; ritorna false se non valido (l'input va ripristinato). */
  onCommitBudget: (raw: string) => boolean;
}

/** Riga legenda: avatar+nome categoria, importo speso, budget editabile inline, badge saturazione/quota. */
function CategoryLegendRow({
  entry,
  budgetAmount,
  saturazionePct,
  quotaPct,
  currency,
  isSaving,
  hasError,
  onCommitBudget,
}: CategoryLegendRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  function handleBlur() {
    const isValid = onCommitBudget(budgetInput);
    if (!isValid) {
      setBudgetInput(String(budgetAmount));
    }
  }

  const isOverBudget = saturazionePct !== null && saturazionePct >= BUDGET_OVER_THRESHOLD_PCT;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <CategoryAvatar
          color={entry.color as CategoryColor}
          icon={entry.icon as CategoryIcon}
          size={14}
          className="size-7"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={isOverBudget ? "border-neg/40 bg-neg-soft text-neg" : ""}>
            {saturazionePct === null ? "—" : `${Math.round(saturazionePct)}% budget`}
          </Badge>
          <Badge variant="outline">{quotaPct === null ? "—" : `${Math.round(quotaPct)}% totale`}</Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Budget</span>
          <Input
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 w-20 text-right text-sm"
            aria-label={`Budget mensile per ${entry.name}`}
          />
        </div>
        {hasError && <p className="text-sm text-destructive">Salvataggio non riuscito</p>}
      </div>
    </div>
  );
}
