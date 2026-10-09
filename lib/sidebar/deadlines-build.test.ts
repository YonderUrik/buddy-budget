import { describe, expect, it } from "vitest";
import { buildSidebarDeadlines, MAX_SIDEBAR_DEADLINES, RENEWAL_HREF } from "./deadlines-build";

const NOW = new Date("2026-10-09T08:00:00Z");
const rate = (debtId: string, date: string, overdue = false) => ({ debtId, name: `Debito ${debtId}`, date, amount: 277, overdue });
const conn = (id: string, consentExpiresAt: string | null, status: "pending" | "linked" | "expired" | "error" = "linked") => ({
  id,
  institutionName: `Banca ${id}`,
  status,
  consentExpiresAt,
});

describe("buildSidebarDeadlines", () => {
  it("ordina rate e rinnovi per data", () => {
    const items = buildSidebarDeadlines({
      debtDue: [rate("a", "2026-10-20"), rate("b", "2026-10-12")],
      connections: [conn("c", "2026-10-15T00:00:00Z")],
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual(["rata:b", "rinnovo:c", "rata:a"]);
  });

  it("segna come scaduto un consenso già scaduto o in errore, con data di oggi", () => {
    const items = buildSidebarDeadlines({ debtDue: [], connections: [conn("x", "2026-09-01T00:00:00Z", "expired"), conn("y", null, "error")], now: NOW });
    expect(items.every((i) => i.overdue && i.date === "2026-10-09" && i.href === RENEWAL_HREF)).toBe(true);
  });

  it("ignora i collegamenti sani o ancora in corso", () => {
    const items = buildSidebarDeadlines({
      debtDue: [],
      connections: [conn("ok", "2027-01-01T00:00:00Z"), conn("p", null, "pending")],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("un consenso in scadenza (entro 7 giorni) usa la data di scadenza e non è scaduto", () => {
    const [item] = buildSidebarDeadlines({ debtDue: [], connections: [conn("e", "2026-10-12T10:00:00Z")], now: NOW });
    expect(item).toMatchObject({ kind: "rinnovo", date: "2026-10-12", overdue: false, amount: null });
  });

  it("riporta le rate con importo, link al debito e stato di ritardo", () => {
    const [item] = buildSidebarDeadlines({ debtDue: [rate("a", "2026-10-01", true)], connections: [], now: NOW });
    expect(item).toMatchObject({ kind: "rata", amount: 277, overdue: true, href: "/debiti/finanziamenti?id=a" });
  });

  it("taglia l'elenco al massimo previsto", () => {
    const debtDue = Array.from({ length: 6 }, (_, i) => rate(String(i), `2026-10-${10 + i}`));
    expect(buildSidebarDeadlines({ debtDue, connections: [], now: NOW })).toHaveLength(MAX_SIDEBAR_DEADLINES);
  });
});
