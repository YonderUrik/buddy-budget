import { describe, expect, it } from "vitest";
import { buildGoalsView, type GoalRecord } from "@/lib/goals/view";
import { buildGoalsDigest, findGoalNotice, goalReminderKey } from "./goals";
import { goalsEmail } from "./emails";

const goal = (over: Partial<GoalRecord>): GoalRecord => ({
  id: "g1",
  name: "Viaggio in Giappone",
  kind: "viaggio",
  target: 4000,
  targetDate: null,
  monthly: 200,
  priority: 0,
  achievedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

function view(goals: GoalRecord[], balance = 1400) {
  return buildGoalsView({
    currency: "EUR",
    todayKey: "2026-10-02",
    goals,
    sources: goals.map((g, i) => ({ id: `s${i}`, goalId: g.id, accountId: "a1", instrumentId: null, amount: g.id === "pieno" ? g.target : 1400 })),
    accounts: [{ id: "a1", name: "Illimity", type: "deposito", balance }],
    positions: [],
    capacity: 1000,
    fire: null,
    essential: { monthly: 1450, basis: "dovute", months: 12 },
    debtsTotal: 0,
  });
}

const ctx = { appUrl: "https://app.test", money: (v: number) => `${Math.round(v)} €`, unsubscribeUrl: "https://app.test/u", preferencesUrl: "https://app.test/p" };
const EARLY = new Date("2026-10-02T07:00:00Z");
const MID = new Date("2026-10-15T07:00:00Z");

describe("findGoalNotice", () => {
  it("nei primi giorni del mese manda il promemoria una volta sola", () => {
    const v = view([goal({})]);
    const first = findGoalNotice({ view: v, alreadySent: new Set(), now: EARLY });
    expect(first.reminder?.goals).toHaveLength(1);
    expect(first.keys).toEqual([goalReminderKey(2026, 10)]);
    expect(findGoalNotice({ view: v, alreadySent: new Set(first.keys), now: EARLY }).keys).toEqual([]);
    expect(findGoalNotice({ view: v, alreadySent: new Set(), now: MID }).reminder).toBeNull();
  });

  it("avvisa quando un obiettivo ha tutti i soldi ma non è segnato, e non dopo che lo è", () => {
    const full = goal({ id: "pieno", target: 1000 });
    expect(findGoalNotice({ view: view([full], 5000), alreadySent: new Set(), now: MID }).alerts.map((a) => a.type)).toEqual(["raggiunto"]);
    expect(findGoalNotice({ view: view([{ ...full, achievedAt: "2026-10-10T00:00:00.000Z" }], 5000), alreadySent: new Set(), now: MID }).keys).toEqual([]);
  });

  it("avvisa se la data è vicina e al ritmo di oggi non ci arrivi", () => {
    const soon = goal({ targetDate: "2026-11-01", monthly: 100 });
    const notice = findGoalNotice({ view: view([soon]), alreadySent: new Set(), now: MID });
    expect(notice.alerts.map((a) => a.type)).toEqual(["scadenza"]);
    const far = goal({ targetDate: "2027-06-01", monthly: 100 });
    expect(findGoalNotice({ view: view([far]), alreadySent: new Set(), now: MID }).alerts).toEqual([]);
  });
});

describe("goalsEmail", () => {
  it("dice cosa è successo e porta agli obiettivi, senza importi se nascosti", () => {
    const notice = findGoalNotice({ view: view([goal({ targetDate: "2026-11-01", monthly: 100 })]), alreadySent: new Set(), now: EARLY });
    const email = goalsEmail(notice, { ...ctx, money: () => "••••" });
    expect(email.subject).toBe("Un obiettivo si avvicina alla data");
    expect(email.text).toContain("Viaggio in Giappone");
    expect(email.text).not.toMatch(/\d+ €/);
    expect(email.html).toContain("/analitiche/obiettivi?da=email");
  });
});

describe("buildGoalsDigest", () => {
  it("conta gli aperti e indica il più vicino", () => {
    expect(buildGoalsDigest(view([goal({})]))).toMatchObject({ open: 1, late: 0, nearest: { name: "Viaggio in Giappone", current: 1400 } });
    expect(buildGoalsDigest(view([]))).toBeNull();
  });
});
