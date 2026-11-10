/**
 * Replay a capture from `trade-republic-capture.ts` through the real cash and investment readers, offline. Prints
 * what each would import and, per instrument, the imported quantity against Trade Republic's positions. The output
 * contains personal financial data: run it locally only.
 *
 *   pnpm exec tsx scripts/trade-republic-replay.ts /path/to/trade-republic-capture.json
 */
import { readFileSync } from "node:fs";
import { readTradeRepublicCash } from "@/lib/trade-republic/data";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { readTradeRepublicInvestments, tradeSequence } from "@/lib/trade-republic/investments";
import type { TradeRepublicReader } from "@/lib/trade-republic/socket";

interface Capture {
  cash: unknown;
  en: { timelineTransactions: unknown[] };
  de: { timelineTransactions: unknown[]; timelineActivityLog: unknown[]; details: Record<string, unknown> };
  positions: unknown;
}

/** A reader answering from the captured pages: the `after` cursor of page n returns page n + 1. */
function replayReader(timelines: Record<string, unknown[]>, details: Record<string, unknown>, cash: unknown, positions: unknown): TradeRepublicReader {
  return {
    async read(topic, params = {}) {
      if (topic === "cash") return cash;
      if (topic === "compactPortfolioByType") return positions;
      if (topic === "timelineDetailV2") return details[params.id];
      const pages = timelines[topic] ?? [{ items: [] }];
      if (!params.after) return pages[0];
      const index = pages.findIndex((page) => (page as { cursors?: { after?: string } }).cursors?.after === params.after);
      return pages[index + 1] ?? { items: [] };
    },
    close() {},
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm exec tsx scripts/trade-republic-replay.ts <capture.json>");
  const capture = JSON.parse(readFileSync(file, "utf8")) as Capture;

  const cash = await readTradeRepublicCash(replayReader({ timelineTransactions: capture.en.timelineTransactions }, {}, capture.cash, null), new Date().toISOString().slice(0, 10)).catch((error: Error) => error);
  if (cash instanceof Error) console.log("cash: FAILED", cash.message);
  else {
    const months = cash.movements.map((movement) => movement.date.slice(0, 7)).sort();
    console.log(`cash: ${cash.movements.length} movements ${months[0]} → ${months.at(-1)}, investment events ${cash.investmentEvents}, unrecognized ${cash.unrecognized}, reconciled ${cash.reconciled}`);
    const sum = cash.movements.reduce((total, movement) => total + Number(movement.amount), 0);
    console.log(`  balance ${cash.balance}, sum of imported movements ${sum.toFixed(2)}`);
  }

  const reader = replayReader({ timelineTransactions: capture.de.timelineTransactions, timelineActivityLog: capture.de.timelineActivityLog }, capture.de.details, capture.cash, capture.positions);
  const securitiesAccountNumber = capture.positions ? "captured" : null;
  const investments = await readTradeRepublicInvestments(reader, { securitiesAccountNumber }).catch((error: Error) => error);
  if (investments instanceof Error) { console.log("investments: FAILED", investments.message); return; }
  console.log(`investments: ${investments.trades.length} operations`);
  // The same oversell check the save step runs (same-day order: buys and adjustments before sales).
  const operations = investments.trades.map((trade) => ({ id: trade.eventId, instrumentId: trade.isin, type: trade.side, date: trade.date, quantity: String(trade.quantity), price: String(trade.price), fxRate: "1", fees: String(trade.fees), taxes: String(trade.taxes), grossAmount: trade.grossAmount === null ? null : String(trade.grossAmount) }));
  const oversold = findOversoldTransaction(operations);
  console.log(oversold ? `  OVERSOLD: ${oversold.date} ${oversold.instrumentId}` : "  no oversell");
  const isins = new Set([...investments.trades.map((trade) => trade.isin), ...(investments.positions?.keys() ?? [])]);
  for (const isin of isins) {
    const held = investments.trades.filter((trade) => trade.isin === isin).reduce((total, trade) => total + (trade.side === "vendita" ? -trade.quantity : trade.quantity), 0);
    const reported = investments.positions?.get(isin) ?? 0;
    console.log(`\n${isin}: imported ${held.toFixed(6)}, Trade Republic ${reported} ${Math.abs(held - reported) < 1e-6 ? "OK" : "MISMATCH"}`);
    for (const line of tradeSequence(investments.trades, isin)) console.log(`  ${line}`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
