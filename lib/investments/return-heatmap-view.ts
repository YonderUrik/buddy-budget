import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex } from "@/lib/calc/investments";
import { buildReturnHeatmap, type HeatmapGrouping, type ReturnHeatmap } from "@/lib/calc/return-heatmap";
import { computeHistoryDailyReturns, type DailyReturn } from "@/lib/calc/returns";
import { toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import type { InvestmentData } from "./data";
import { toTransactionInputs } from "./view";

/** Rendimenti giornalieri di tutto lo storico dai dati grezzi (servono i prezzi dalla prima operazione: periodo `max`). */
export function historyDailyReturns(data: InvestmentData, today: Date): DailyReturn[] {
  const transactions = toTransactionInputs(data);
  return computeHistoryDailyReturns({
    transactions,
    instruments: data.instruments,
    priceIndex: buildPriceIndex(data.prices, data.manualPrices, transactions),
    fx: buildFxTable(data.fxRates),
    userCurrency: data.currency,
    today,
  });
}

/** Heatmap dei rendimenti con il raggruppamento scelto. */
export function heatmapFromDaily(daily: DailyReturn[], grouping: HeatmapGrouping, today: Date): ReturnHeatmap | null {
  return buildReturnHeatmap(daily, grouping, toDateKey(startOfDay(today)));
}
