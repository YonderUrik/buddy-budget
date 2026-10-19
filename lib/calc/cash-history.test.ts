import { describe, expect, it } from "vitest";
import { ledgerAmountToday, planCashHistory, type LedgerAccount, type LedgerTransaction, type StoredCashRow } from "./cash-history";

const TODAY = new Date(2026, 8, 13); // 13 September 2026
const LONG_AGO = new Date(2020, 0, 1);

const bank = (balance: number, createdAt = LONG_AGO): LedgerAccount => ({ id: "bank", kind: "auto", balance, createdAt });
const imported = (balance: number, createdAt = LONG_AGO): LedgerAccount => ({ id: "csv", kind: "import", balance, createdAt });
const tx = (date: string, amount: number, accountId = "bank", createdAt = LONG_AGO): LedgerTransaction => ({ accountId, date, amount, createdAt });
const row = (date: string, amount: number, ledgerAmount: number | null, updatedAt = new Date(`${date}T23:50:00Z`)): StoredCashRow => ({ date, amount, ledgerAmount, updatedAt });

describe("planCashHistory", () => {
  it("reconstructs a new user's history from bank transactions, up to yesterday", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(1000)], transactions: [tx("2026-09-11", -100), tx("2026-09-12", 50)], manualNow: 200, today: TODAY });
    expect(writes).toEqual([
      { date: "2026-09-11", amount: 1150, ledgerAmount: 950, insert: true },
      { date: "2026-09-12", amount: 1200, ledgerAmount: 1000, insert: true },
    ]);
  });

  it("writes nothing without ledger accounts, apart from recording a zero ledger part on old rows", () => {
    expect(planCashHistory({ rows: [], accounts: [], transactions: [], manualNow: 300, today: TODAY })).toEqual([]);
    expect(planCashHistory({ rows: [row("2026-09-10", 300, null)], accounts: [], transactions: [], manualNow: 300, today: TODAY })).toEqual([
      { date: "2026-09-10", amount: 300, ledgerAmount: 0, insert: false },
    ]);
  });

  it("a file imported today moves the past days it covers and fills the days before the first row", () => {
    // Snapshots since 09-11 only had a manual account of 500. Today a file brings 09-09 +1,000 and 09-12 -200.
    const importedAt = new Date(2026, 8, 13, 10);
    const writes = planCashHistory({
      rows: [row("2026-09-11", 500, null), row("2026-09-12", 500, null)],
      accounts: [imported(800, importedAt)],
      transactions: [tx("2026-09-09", 1000, "csv", importedAt), tx("2026-09-12", -200, "csv", importedAt)],
      manualNow: 500,
      today: TODAY,
    });
    expect(writes).toEqual([
      { date: "2026-09-09", amount: 1500, ledgerAmount: 1000, insert: true },
      { date: "2026-09-10", amount: 1500, ledgerAmount: 1000, insert: true },
      { date: "2026-09-11", amount: 1500, ledgerAmount: 1000, insert: false },
      { date: "2026-09-12", amount: 1300, ledgerAmount: 800, insert: false },
    ]);
  });

  it("keeps the manual part each row recorded and only moves the ledger part", () => {
    // The manual account was 300 on 09-11 and 400 on 09-12; a bank transaction of 09-12 changes from -50 to -80.
    const writes = planCashHistory({
      rows: [row("2026-09-11", 1300, 1000), row("2026-09-12", 1350, 950)],
      accounts: [bank(920)],
      transactions: [tx("2026-09-12", -80)],
      manualNow: 400,
      today: TODAY,
    });
    // 09-11 is unchanged (1,000 at the end of the day either way), so only 09-12 is written.
    expect(writes).toEqual([{ date: "2026-09-12", amount: 1320, ledgerAmount: 920, insert: false }]);
  });

  it("a deleted import takes its transactions out of the history", () => {
    const writes = planCashHistory({
      rows: [row("2026-09-11", 1500, 1000), row("2026-09-12", 1300, 800)],
      accounts: [imported(0)],
      transactions: [],
      manualNow: 500,
      today: TODAY,
    });
    expect(writes).toEqual([
      { date: "2026-09-11", amount: 500, ledgerAmount: 0, insert: false },
      { date: "2026-09-12", amount: 500, ledgerAmount: 0, insert: false },
    ]);
  });

  it("estimates the ledger part of old rows from what was known when they were written", () => {
    // Bank connected long ago (already in the snapshot), import account whose first file arrived on 09-12 at noon.
    const firstFile = new Date(2026, 8, 12, 12);
    const secondFile = new Date(2026, 8, 13, 9);
    const writes = planCashHistory({
      rows: [row("2026-09-11", 1200, null, new Date(2026, 8, 11, 23)), row("2026-09-12", 1300, null, new Date(2026, 8, 12, 23))],
      accounts: [bank(1000), imported(150, firstFile)],
      transactions: [tx("2026-09-10", 100, "csv", firstFile), tx("2026-09-11", 50, "csv", secondFile)],
      manualNow: 200,
      today: TODAY,
    });
    // 09-11: written before any import, bank 1,000 → manual 200; now bank 1,000 + csv 150 = 1,350.
    // 09-12: written after the first file (csv 100) → manual 200; now 1,000 + 150.
    expect(writes).toEqual([
      { date: "2026-09-10", amount: 1300, ledgerAmount: 1100, insert: true },
      { date: "2026-09-11", amount: 1350, ledgerAmount: 1150, insert: false },
      { date: "2026-09-12", amount: 1350, ledgerAmount: 1150, insert: false },
    ]);
  });

  it("a bank connected after a row was written adds its reconstructed balance to that row", () => {
    const connectedAt = new Date(2026, 8, 13, 8);
    const writes = planCashHistory({
      rows: [row("2026-09-12", 200, null)],
      accounts: [bank(1000, connectedAt)],
      transactions: [tx("2026-09-12", -100, "bank", connectedAt)],
      manualNow: 200,
      today: TODAY,
    });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 1200, ledgerAmount: 1000, insert: false }]);
  });

  it("transactions dated today already count in yesterday's ledger part", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(1000)], transactions: [tx("2026-09-12", -20), tx("2026-09-13", 30)], manualNow: 0, today: TODAY });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 970, ledgerAmount: 970, insert: true }]);
  });

  it("never touches today's row and caps new rows at 24 months from the first day of the month", () => {
    const writes = planCashHistory({ rows: [row("2026-09-13", 1, 1)], accounts: [bank(1000)], transactions: [tx("2023-01-15", -10)], manualNow: 0, today: TODAY });
    expect(writes[0].date).toBe("2024-09-01");
    expect(writes.at(-1)!.date).toBe("2026-09-12");
    expect(writes.every((w) => w.amount === 1000 && w.insert)).toBe(true);
  });

  it("fills gaps between rows with the manual part of the day before", () => {
    const writes = planCashHistory({
      rows: [row("2026-09-10", 1300, 1000), row("2026-09-12", 1440, 1040)],
      accounts: [bank(1040)],
      transactions: [tx("2026-09-10", 0), tx("2026-09-11", 40)],
      manualNow: 400,
      today: TODAY,
    });
    expect(writes).toEqual([{ date: "2026-09-11", amount: 1340, ledgerAmount: 1040, insert: true }]);
  });

  it("works in cents, without float drift", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(0.3)], transactions: [tx("2026-09-12", 0.1), tx("2026-09-12", 0.2)], manualNow: 0, today: TODAY });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 0.3, ledgerAmount: 0.3, insert: true }]);
  });
});

describe("ledgerAmountToday", () => {
  it("is the ledger balances minus transactions dated after today", () => {
    expect(ledgerAmountToday([bank(1000), imported(200)], [tx("2026-09-14", -50)], TODAY)).toBe(1250);
  });
});
