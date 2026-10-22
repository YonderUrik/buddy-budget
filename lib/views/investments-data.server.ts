import "server-only";
import { after } from "next/server";
import { loadInvestmentData, type InvestmentData } from "@/lib/investments/data";
import { filterInvestmentBrokers } from "@/lib/investments/broker-filter";
import { ensureDividendsSafely, ensureProfilesSafely } from "@/lib/market-data/runtime";

/** The user's whole investment data and the same data with the excluded brokers left out. */
export interface LoadedInvestmentData {
  /** Everything, for the broker list (the filter never hides a broker from its own selector). */
  all: InvestmentData;
  /** `filterInvestmentBrokers(all, excluded)`: what the tabs compute on. */
  data: InvestmentData;
}

/**
 * Loads `GET /api/investments/overview?period=max` for a user, as the browser receives it (JSON round trip: dates
 * become strings exactly as on the web), and applies the view-only broker filter. Like the overview route, missing
 * profiles and dividend histories are downloaded in the background after the response.
 */
export async function loadInvestmentViewData(userId: string, excludedBrokers: ReadonlySet<string>): Promise<LoadedInvestmentData> {
  const raw = await loadInvestmentData(userId, null);
  await ensureProfilesSafely(raw.instruments, after);
  await ensureDividendsSafely(raw.instruments, after);
  const all = JSON.parse(JSON.stringify(raw)) as InvestmentData;
  return { all, data: filterInvestmentBrokers(all, excludedBrokers) };
}
