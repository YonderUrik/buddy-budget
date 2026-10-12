import { describe, expect, it } from "vitest";
import { planConnectionCleanup, planRemoteSweep, type CleanupConnection } from "./cleanup-plan";

const NOW = new Date("2026-10-01T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function connection(overrides: Partial<CleanupConnection>): CleanupConnection {
  return {
    id: "c1",
    status: "linked",
    requisitionId: "req-1",
    consentExpiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
    createdAt: daysAgo(60),
    orphanedAt: null,
    linkCount: 1,
    userDeactivated: false,
    ...overrides,
  };
}

describe("planConnectionCleanup", () => {
  it("non tocca una connessione sana con conti collegati", () => {
    expect(planConnectionCleanup([connection({})], NOW)).toEqual({ actions: [], markOrphaned: [], clearOrphaned: [] });
  });

  it("elimina i tentativi mai completati solo dopo 3 giorni, riga compresa", () => {
    const recent = connection({ id: "recent", status: "pending", linkCount: 0, createdAt: daysAgo(2) });
    const old = connection({ id: "old", status: "error", linkCount: 0, createdAt: daysAgo(4) });
    const noRequisition = connection({ id: "none", status: "error", requisitionId: null, linkCount: 0, createdAt: daysAgo(10) });
    const { actions } = planConnectionCleanup([recent, old, noRequisition], NOW);
    expect(actions).toEqual([
      { connectionId: "old", kind: "abandoned_attempt", requisitionId: "req-1", deleteRow: true, orphanedAt: null },
      { connectionId: "none", kind: "abandoned_attempt", requisitionId: null, deleteRow: true, orphanedAt: null },
    ]);
  });

  it("segna una connessione senza conti e la elimina solo dopo 7 giorni dal segno", () => {
    const first = planConnectionCleanup([connection({ id: "a", linkCount: 0 })], NOW);
    expect(first.markOrphaned).toEqual(["a"]);
    expect(first.actions).toEqual([]);

    const waiting = planConnectionCleanup([connection({ id: "a", linkCount: 0, orphanedAt: daysAgo(6) })], NOW);
    expect(waiting.actions).toEqual([]);

    const due = planConnectionCleanup([connection({ id: "a", linkCount: 0, orphanedAt: daysAgo(8) })], NOW);
    expect(due.actions).toEqual([{ connectionId: "a", kind: "orphan_connection", requisitionId: "req-1", deleteRow: true }]);
  });

  it("azzera il segno di orfana se la connessione ha di nuovo conti", () => {
    expect(planConnectionCleanup([connection({ id: "a", orphanedAt: daysAgo(3) })], NOW).clearOrphaned).toEqual(["a"]);
  });

  it("elimina la requisition di una connessione scaduta da oltre 30 giorni ma tiene la riga (il conto resta da riconnettere)", () => {
    const stale = connection({ id: "s", status: "expired", consentExpiresAt: daysAgo(31) });
    const fresh = connection({ id: "f", status: "expired", consentExpiresAt: daysAgo(10) });
    const byDateOnly = connection({ id: "d", status: "linked", consentExpiresAt: daysAgo(40) });
    const { actions } = planConnectionCleanup([stale, fresh, byDateOnly], NOW);
    expect(actions).toEqual([
      { connectionId: "s", kind: "expired_connection", requisitionId: "req-1", deleteRow: false },
      { connectionId: "d", kind: "expired_connection", requisitionId: "req-1", deleteRow: false },
    ]);
  });

  it("senza data di scadenza parte da creazione + 90 giorni; senza requisition non c'è nulla da eliminare", () => {
    const noDate = connection({ id: "n", status: "expired", consentExpiresAt: null, createdAt: daysAgo(125) });
    const noDateRecent = connection({ id: "r", status: "expired", consentExpiresAt: null, createdAt: daysAgo(100) });
    const alreadyCleaned = connection({ id: "x", status: "expired", requisitionId: null, consentExpiresAt: daysAgo(90) });
    expect(planConnectionCleanup([noDate, noDateRecent, alreadyCleaned], NOW).actions.map((a) => a.connectionId)).toEqual(["n"]);
  });

  it("ignora gli utenti con eliminazione programmata (disattivazione reversibile)", () => {
    const plan = planConnectionCleanup(
      [
        connection({ id: "a", status: "error", linkCount: 0, createdAt: daysAgo(20), userDeactivated: true }),
        connection({ id: "b", linkCount: 0, userDeactivated: true }),
      ],
      NOW
    );
    expect(plan).toEqual({ actions: [], markOrphaned: [], clearOrphaned: [] });
  });
});

describe("planRemoteSweep", () => {
  const known = new Set(["req-1"]);
  const OWN = "https://app.example.com/api/gocardless/callback";
  const base = {
    requisitions: [
      { id: "req-1", created: daysAgo(100).toISOString(), status: "EX", agreement: "ag-1" },
      { id: "req-old-cr", created: daysAgo(45).toISOString(), status: "CR", agreement: "ag-2" },
      { id: "req-new-cr", created: daysAgo(5).toISOString(), status: "CR", agreement: "ag-3" },
      { id: "req-old-ln", created: daysAgo(45).toISOString(), status: "LN", agreement: "ag-4", redirect: "http://localhost:3000/api/gocardless/callback" },
    ],
    agreements: [
      { id: "ag-1", created: daysAgo(100).toISOString() },
      { id: "ag-2", created: daysAgo(45).toISOString() },
      { id: "ag-orphan-old", created: daysAgo(45).toISOString() },
      { id: "ag-orphan-new", created: daysAgo(2).toISOString() },
    ],
    knownRequisitionIds: known,
  };

  it("propone solo requisition altrui, vecchie e non collegate; elenca quelle LN senza eliminarle", () => {
    const sweep = planRemoteSweep(base, NOW);
    expect(sweep.requisitionIds).toEqual(["req-old-cr"]);
    expect(sweep.staleRequisitionIds).toEqual([]);
    expect(sweep.linkedUnknown).toEqual([{ id: "req-old-ln", origin: "foreign", ageDays: 45, redirectHost: "localhost" }]);
  });

  it("le nostre mai collegate (URL di ritorno o reference) sono tentativi abbandonati: grazia di 3 giorni, senza flag", () => {
    const sweep = planRemoteSweep(
      {
        ...base,
        requisitions: [
          { id: "own-gc", created: daysAgo(4).toISOString(), status: "GC", redirect: OWN },
          { id: "own-new", created: daysAgo(1).toISOString(), status: "CR", redirect: OWN },
          { id: "superseded", created: daysAgo(4).toISOString(), status: "CR", reference: "conn-1", redirect: "https://old.example.com/cb" },
          { id: "foreign-young", created: daysAgo(10).toISOString(), status: "CR", redirect: "http://localhost:3000/api/gocardless/callback" },
        ],
        knownConnectionIds: new Set(["conn-1"]),
        ownRedirect: OWN,
      },
      NOW
    );
    expect(sweep.staleRequisitionIds).toEqual(["own-gc", "superseded"]);
    expect(sweep.requisitionIds).toEqual([]);
  });

  it("classifica le LN sconosciute per origine", () => {
    const sweep = planRemoteSweep(
      {
        ...base,
        requisitions: [
          { id: "ln-gone", created: daysAgo(20).toISOString(), status: "LN", reference: "conn-x", redirect: OWN },
          { id: "ln-superseded", created: daysAgo(20).toISOString(), status: "LN", reference: "conn-1", redirect: OWN },
          { id: "ln-young", created: daysAgo(1).toISOString(), status: "LN", redirect: OWN },
        ],
        knownConnectionIds: new Set(["conn-1"]),
        ownRedirect: OWN,
      },
      NOW
    );
    expect(sweep.linkedUnknown.map(({ id, origin }) => [id, origin])).toEqual([
      ["ln-gone", "own_row_gone"],
      ["ln-superseded", "own_superseded"],
    ]);
    expect(sweep.staleRequisitionIds).toEqual([]);
  });

  it("propone solo agreement non citati da nessuna requisition e vecchi", () => {
    expect(planRemoteSweep(base, NOW).agreementIds).toEqual(["ag-orphan-old"]);
  });

  it("non propone nulla se l'app non conosce alcuna requisition (DB vuoto o ambiente condiviso)", () => {
    expect(planRemoteSweep({ ...base, knownRequisitionIds: new Set(), ownRedirect: OWN }, NOW)).toEqual({
      staleRequisitionIds: [],
      requisitionIds: [],
      agreementIds: [],
      linkedUnknown: [],
    });
  });
});
