import { describe, expect, it } from "vitest";
import { buildSyncErrorMessage, buildSyncSummaryMessage } from "./sync-messages";

describe("buildSyncSummaryMessage", () => {
  it("segnala nessuna nuova transazione", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 0,
        categorizedCount: 0,
        uncategorizedCount: 0,
        balanceUpdated: true,
      })
    ).toBe("Nessuna nuova transazione trovata. Saldo aggiornato.");
  });

  it("riepiloga nuove transazioni categorizzate e non", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 5,
        categorizedCount: 3,
        uncategorizedCount: 2,
        balanceUpdated: true,
      })
    ).toBe("5 nuove transazioni (3 categorizzate, 2 da categorizzare). Saldo aggiornato.");
  });

  it("usa il singolare per una sola transazione categorizzata", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 1,
        categorizedCount: 1,
        uncategorizedCount: 0,
        balanceUpdated: true,
      })
    ).toBe("1 nuova transazione (1 categorizzata). Saldo aggiornato.");
  });

  it("combina singolare categorizzata e plurale da categorizzare", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 3,
        categorizedCount: 1,
        uncategorizedCount: 2,
        balanceUpdated: true,
      })
    ).toBe("3 nuove transazioni (1 categorizzata, 2 da categorizzare). Saldo aggiornato.");
  });

  it("omette la parte categorizzate quando il conteggio è zero", () => {
    expect(
      buildSyncSummaryMessage({
        status: "synced",
        newTransactionsCount: 2,
        categorizedCount: 0,
        uncategorizedCount: 2,
        balanceUpdated: true,
      })
    ).toBe("2 nuove transazioni (2 da categorizzare). Saldo aggiornato.");
  });
});

describe("buildSyncErrorMessage", () => {
  it("gocardless-limited", () => {
    expect(buildSyncErrorMessage({ status: "gocardless-limited" })).toBe(
      "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."
    );
  });

  it("expired", () => {
    expect(buildSyncErrorMessage({ status: "expired" })).toBe(
      "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare."
    );
  });

  it("not-eligible con orario", () => {
    const nextEligibleAt = new Date("2026-07-26T15:30:00.000Z").toISOString();
    const message = buildSyncErrorMessage({ status: "not-eligible", nextEligibleAt, syncsRemainingToday: 0 });
    expect(message).toContain("Prossimo disponibile alle");
  });

  it("not-eligible senza orario", () => {
    expect(buildSyncErrorMessage({ status: "not-eligible", nextEligibleAt: null, syncsRemainingToday: 0 })).toBe(
      "Sync non disponibile al momento. Riprova più tardi."
    );
  });

  it("unknown", () => {
    expect(buildSyncErrorMessage({ status: "unknown" })).toBe(
      "Impossibile completare la sincronizzazione. Riprova più tardi."
    );
  });
});
