import { describe, expect, it } from "vitest";
import { queuedAccount, type SyncJobAccount, type SyncJobView } from "@/lib/sync-jobs/types";
import { describeAccountProgress, describeJobTitle } from "./describe-account-progress";

function account(overrides: Partial<SyncJobAccount>): SyncJobAccount {
  return { ...queuedAccount("a", "Conto"), ...overrides };
}

describe("describeAccountProgress", () => {
  it("descrive le fasi in corso con la barra giusta", () => {
    expect(describeAccountProgress(account({ phase: "queued" }), false)).toEqual({
      text: "In attesa",
      bar: { kind: "none" },
      tone: "default",
    });
    expect(describeAccountProgress(account({ phase: "balance" }), false).text).toBe("Aggiorno il saldo…");
    expect(describeAccountProgress(account({ phase: "fetching" }), false)).toEqual({
      text: "Scarico i movimenti dalla banca…",
      bar: { kind: "indeterminate" },
      tone: "default",
    });
    expect(describeAccountProgress(account({ phase: "saving", total: 500, processed: 120 }), false)).toEqual({
      text: "Importati 120 di 500 movimenti",
      bar: { kind: "determinate", value: 120, max: 500 },
      tone: "default",
    });
  });

  it("usa il singolare con un solo movimento", () => {
    expect(describeAccountProgress(account({ phase: "saving", total: 1, processed: 0 }), false).text).toBe(
      "Importati 0 di 1 movimento"
    );
  });

  it("riassume un conto concluso riusando il messaggio di esito esistente", () => {
    expect(
      describeAccountProgress(account({ phase: "done", total: 3, processed: 3, inserted: 3, categorized: 2, uncategorized: 1 }), false)
    ).toEqual({
      text: "3 nuove transazioni (2 categorizzate, 1 da categorizzare). Saldo aggiornato.",
      bar: { kind: "determinate", value: 1, max: 1 },
      tone: "success",
    });
    expect(describeAccountProgress(account({ phase: "done", inserted: 0 }), false).text).toBe(
      "Nessuna nuova transazione trovata. Saldo aggiornato."
    );
  });

  it("spiega errori, limiti, sessione scaduta e interruzione", () => {
    expect(describeAccountProgress(account({ phase: "limited" }), false).text).toBe(
      "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."
    );
    expect(describeAccountProgress(account({ phase: "expired" }), false).tone).toBe("error");
    expect(describeAccountProgress(account({ phase: "error", errorReason: "already-running" }), false).text).toBe(
      "Sincronizzazione già in corso per questo conto."
    );
    expect(describeAccountProgress(account({ phase: "error" }), false).text).toBe(
      "Sincronizzazione non riuscita. Riprova più tardi."
    );
    expect(describeAccountProgress(account({ phase: "error" }), true).text).toBe(
      "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì."
    );
  });
});

describe("describeJobTitle", () => {
  const base: SyncJobView = {
    id: "j",
    userId: "u",
    kind: "initial-import",
    status: "running",
    dismissed: false,
    startedAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    accounts: [account({}), account({ accountId: "b" })],
    interrupted: false,
  };

  it("titola il job in base allo stato", () => {
    expect(describeJobTitle(base)).toBe("Sincronizzazione in corso · 2 conti");
    expect(describeJobTitle({ ...base, accounts: [account({})] })).toBe("Sincronizzazione in corso · 1 conto");
    expect(describeJobTitle({ ...base, status: "done" })).toBe("Sincronizzazione completata");
    expect(describeJobTitle({ ...base, status: "failed" })).toBe("Sincronizzazione non riuscita");
    expect(describeJobTitle({ ...base, status: "done", interrupted: true })).toBe("Sincronizzazione interrotta");
  });
});
