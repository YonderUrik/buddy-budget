import { describe, expect, it } from "vitest";
import { ledgerAmountToday, planCashHistory, type LedgerAccount, type LedgerTransaction, type StatementCashAccount, type StoredCashRow } from "./cash-history";

const TODAY = new Date(2026, 8, 13); // 13 September 2026
const LONG_AGO = new Date(2020, 0, 1);

const bank = (balance: number, createdAt = LONG_AGO): LedgerAccount => ({ id: "bank", kind: "auto", balance, createdAt });
const imported = (balance: number, createdAt = LONG_AGO): LedgerAccount => ({ id: "csv", kind: "import", balance, createdAt });
const tx = (date: string, amount: number, accountId = "bank", createdAt = LONG_AGO): LedgerTransaction => ({ accountId, date, amount, createdAt });
const row = (date: string, amount: number, ledgerAmount: number | null, updatedAt = new Date(`${date}T23:50:00Z`)): StoredCashRow => ({ date, amount, ledgerAmount, updatedAt });

/** A broker cash account from `from`, with the balance (in euros) given for some days and carried to the next ones. */
const broker = (from: string, balances: Record<string, number>, createdAt = LONG_AGO): StatementCashAccount => {
  const days = Object.keys(balances).sort();
  return { id: "ibkr", createdAt, from, centsOn: (day) => {
    if (day < from) return 0;
    const last = days.filter((d) => d <= day).at(-1);
    return last ? Math.round(balances[last] * 100) : 0;
  } };
};

describe("planCashHistory", () => {
  it("reconstructs a new user's history from bank transactions, up to yesterday", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(1000)], transactions: [tx("2026-09-11", -100), tx("2026-09-12", 50)], manualNow: 200, today: TODAY });
    expect(writes).toEqual([
      { date: "2026-09-11", amount: 1150, ledgerAmount: 950, statementAmount: 0, insert: true },
      { date: "2026-09-12", amount: 1200, ledgerAmount: 1000, statementAmount: 0, insert: true },
    ]);
  });

  it("writes nothing without ledger accounts, apart from recording a zero ledger part on old rows", () => {
    expect(planCashHistory({ rows: [], accounts: [], transactions: [], manualNow: 300, today: TODAY })).toEqual([]);
    expect(planCashHistory({ rows: [row("2026-09-10", 300, null)], accounts: [], transactions: [], manualNow: 300, today: TODAY })).toEqual([
      { date: "2026-09-10", amount: 300, ledgerAmount: 0, statementAmount: 0, insert: false },
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
      { date: "2026-09-09", amount: 1500, ledgerAmount: 1000, statementAmount: 0, insert: true },
      { date: "2026-09-10", amount: 1500, ledgerAmount: 1000, statementAmount: 0, insert: true },
      { date: "2026-09-11", amount: 1500, ledgerAmount: 1000, statementAmount: 0, insert: false },
      { date: "2026-09-12", amount: 1300, ledgerAmount: 800, statementAmount: 0, insert: false },
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
    expect(writes).toEqual([{ date: "2026-09-12", amount: 1320, ledgerAmount: 920, statementAmount: 0, insert: false }]);
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
      { date: "2026-09-11", amount: 500, ledgerAmount: 0, statementAmount: 0, insert: false },
      { date: "2026-09-12", amount: 500, ledgerAmount: 0, statementAmount: 0, insert: false },
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
      { date: "2026-09-10", amount: 1300, ledgerAmount: 1100, statementAmount: 0, insert: true },
      { date: "2026-09-11", amount: 1350, ledgerAmount: 1150, statementAmount: 0, insert: false },
      { date: "2026-09-12", amount: 1350, ledgerAmount: 1150, statementAmount: 0, insert: false },
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
    expect(writes).toEqual([{ date: "2026-09-12", amount: 1200, ledgerAmount: 1000, statementAmount: 0, insert: false }]);
  });

  it("rebuilds a broker cash account from its statements and fills the days back to its first statement", () => {
    const writes = planCashHistory({
      rows: [],
      accounts: [],
      transactions: [],
      statementAccounts: [broker("2026-09-10", { "2026-09-10": 2400, "2026-09-12": -13000 })],
      manualNow: 100,
      today: TODAY,
    });
    expect(writes).toEqual([
      { date: "2026-09-10", amount: 2500, ledgerAmount: 0, statementAmount: 2400, insert: true },
      { date: "2026-09-11", amount: 2500, ledgerAmount: 0, statementAmount: 2400, insert: true },
      { date: "2026-09-12", amount: -12900, ledgerAmount: 0, statementAmount: -13000, insert: true },
    ]);
  });

  it("takes out of old rows the broker balance they recorded as manual, however old, and puts the rebuilt one in", () => {
    // The account was created on 09-11 at 10:00 from a statement that ended months earlier (500). The 09-10 row
    // predates it (manual 100 only); the 09-11 and 09-12 snapshots counted the stale 500 inside their manual part.
    const createdAt = new Date("2026-09-11T10:00:00Z");
    const writes = planCashHistory({
      rows: [row("2026-09-10", 100, 0), row("2026-09-11", 600, 0), row("2026-09-12", 600, 0)],
      accounts: [],
      transactions: [],
      statementAccounts: [broker("2026-01-01", { "2026-01-01": 1000, "2026-09-11": 2400, "2026-09-12": -13000 }, createdAt)],
      manualNow: 100,
      manualAccounts: [{ balance: 100, createdAt: LONG_AGO }],
      today: TODAY,
    });
    // Manual stays 100 on every day; the past before the first row now carries the rebuilt balance too.
    expect(writes.filter((w) => !w.insert)).toEqual([
      { date: "2026-09-10", amount: 1100, ledgerAmount: 0, statementAmount: 1000, insert: false },
      { date: "2026-09-11", amount: 2500, ledgerAmount: 0, statementAmount: 2400, insert: false },
      { date: "2026-09-12", amount: -12900, ledgerAmount: 0, statementAmount: -13000, insert: false },
    ]);
    expect(writes.find((w) => w.date === "2026-01-01")).toEqual({ date: "2026-01-01", amount: 1100, ledgerAmount: 0, statementAmount: 1000, insert: true });
  });

  it("removes a broker balance copied onto days before the broker account existed (no double count)", () => {
    // As found on production: the broker account was created on 09-11; days 09-08..09-10 were filled in afterwards
    // (first written on 09-12) and copied the broker balance, 500, as their manual part. The user has no manual account.
    const brokerCreated = new Date("2026-09-11T10:00:00Z");
    const filledLater = new Date("2026-09-12T08:00:00Z");
    const copied = (date: string): StoredCashRow => ({ ...row(date, 1500, 1000), createdAt: filledLater, updatedAt: filledLater });
    const writes = planCashHistory({
      rows: [copied("2026-09-09"), copied("2026-09-10"), row("2026-09-11", 1500, 1000), row("2026-09-12", 1500, 1000)],
      accounts: [bank(1000)],
      transactions: [],
      statementAccounts: [broker("2026-09-01", { "2026-09-01": 300, "2026-09-11": 500 }, brokerCreated)],
      manualNow: 0,
      manualAccounts: [],
      today: TODAY,
    });
    // Each day holds the bank plus the rebuilt broker balance of that day, once: 300 before 09-11, 500 from 09-11.
    expect(writes.filter((w) => !w.insert)).toEqual([
      { date: "2026-09-09", amount: 1300, ledgerAmount: 1000, statementAmount: 300, insert: false },
      { date: "2026-09-10", amount: 1300, ledgerAmount: 1000, statementAmount: 300, insert: false },
      { date: "2026-09-11", amount: 1500, ledgerAmount: 1000, statementAmount: 500, insert: false },
      { date: "2026-09-12", amount: 1500, ledgerAmount: 1000, statementAmount: 500, insert: false },
    ]);
  });

  it("keeps a manual balance recorded before the broker account existed, even when it has changed since", () => {
    // The cash account held 200 when 09-10 was written; it holds 50 now. The broker account came later, on 09-11.
    const brokerCreated = new Date("2026-09-11T10:00:00Z");
    const writes = planCashHistory({
      rows: [row("2026-09-10", 200, 0)],
      accounts: [],
      transactions: [],
      statementAccounts: [broker("2026-09-11", { "2026-09-11": 500 }, brokerCreated)],
      manualNow: 50,
      manualAccounts: [{ balance: 50, createdAt: LONG_AGO }],
      today: TODAY,
    });
    // 09-10 keeps its 200 (no broker cash then); 09-11..09-12 are new days: manual carried from 09-10, broker rebuilt.
    expect(writes).toEqual([
      { date: "2026-09-10", amount: 200, ledgerAmount: 0, statementAmount: 0, insert: false },
      { date: "2026-09-11", amount: 700, ledgerAmount: 0, statementAmount: 500, insert: true },
      { date: "2026-09-12", amount: 700, ledgerAmount: 0, statementAmount: 500, insert: true },
    ]);
  });

  it("moves only the statement part once a row has one, when a later import corrects the past", () => {
    const writes = planCashHistory({
      rows: [{ ...row("2026-09-11", 2500, 0), statementAmount: 2400 }, { ...row("2026-09-12", 2500, 0), statementAmount: 2400 }],
      accounts: [],
      transactions: [],
      statementAccounts: [broker("2026-09-11", { "2026-09-11": 2400, "2026-09-12": 2350 })],
      manualNow: 100,
      today: TODAY,
    });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 2450, ledgerAmount: 0, statementAmount: 2350, insert: false }]);
  });

  it("leaves rows of users without statement accounts alone", () => {
    expect(planCashHistory({ rows: [row("2026-09-10", 300, 0)], accounts: [], transactions: [], manualNow: 300, today: TODAY })).toEqual([]);
  });

  it("transactions dated today already count in yesterday's ledger part", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(1000)], transactions: [tx("2026-09-12", -20), tx("2026-09-13", 30)], manualNow: 0, today: TODAY });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 970, ledgerAmount: 970, statementAmount: 0, insert: true }]);
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
    expect(writes).toEqual([{ date: "2026-09-11", amount: 1340, ledgerAmount: 1040, statementAmount: 0, insert: true }]);
  });

  it("works in cents, without float drift", () => {
    const writes = planCashHistory({ rows: [], accounts: [bank(0.3)], transactions: [tx("2026-09-12", 0.1), tx("2026-09-12", 0.2)], manualNow: 0, today: TODAY });
    expect(writes).toEqual([{ date: "2026-09-12", amount: 0.3, ledgerAmount: 0.3, statementAmount: 0, insert: true }]);
  });
});

describe("ledgerAmountToday", () => {
  it("is the ledger balances minus transactions dated after today", () => {
    expect(ledgerAmountToday([bank(1000), imported(200)], [tx("2026-09-14", -50)], TODAY)).toBe(1250);
  });
});
