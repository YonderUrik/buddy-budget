import * as S from "@/lib/calc/subscriptions";
import { buildSubscriptionsView, upcomingCharges, recentPriceRises } from "@/lib/subscriptions/view";
import { distributeColors } from "@/lib/calc/distribute-colors";
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { writeFileSync } from "node:fs";
const OUT = process.argv[2];
const V: any[] = [];
const add = (id: string, fn: string, input: any, expected: any, notes = "") => V.push({ id, function: fn, input, expected, tolerance: 1e-9, ...(notes ? { notes } : {}) });
for (const [a, c] of [[9.99,"mensile"],[12,"settimanale"],[29.97,"trimestrale"],[59.99,"semestrale"],[99,"annuale"]] as const) add(`subs.monthlyEquivalent.${c}`, "monthlyEquivalent", { amount: a, cadence: c }, S.monthlyEquivalent(a, c));
for (const [d, c, day] of [["2026-01-31","mensile",undefined],["2026-01-15","mensile",31],["2026-11-30","trimestrale",undefined],["2026-12-29","settimanale",undefined],["2024-02-29","annuale",undefined]] as const) add(`subs.nextChargeDate.${d}.${c}.${day ?? "-"}`, "nextChargeDate", { lastDate: d, cadence: c, day: day ?? null }, S.nextChargeDate(d, c, day));
for (const desc of ["PAGAMENTO POS NETFLIX.COM 12/10 CARTA 1234", "SDD SPOTIFY AB REF 99887", "Amazon Prime*2K3J4", "ADDEBITO DIRETTO ENEL ENERGIA SPA"]) add(`subs.subscriptionKey.${desc}`, "subscriptionKey", { description: desc }, S.subscriptionKey(desc), `merchantKey = ${JSON.stringify(merchantKey(desc))}`);
const mk = (id: string, date: string, amount: number, description = "NETFLIX.COM", categoryId: string | null = "fun") => ({ id, date, amount, description, categoryId });
const netflix = [mk("n1","2026-06-12",12.99), mk("n2","2026-07-12",12.99), mk("n3","2026-08-13",12.99), mk("n4","2026-09-12",13.99), mk("n5","2026-10-12",13.99)];
const gym = [mk("g1","2025-10-01",399,"PALESTRA FIT"), mk("g2","2026-10-03",420,"PALESTRA FIT")];
const grocery = [mk("s1","2026-08-02",54.1,"SUPERMERCATO"), mk("s2","2026-09-01",23.7,"SUPERMERCATO"), mk("s3","2026-10-01",88.0,"SUPERMERCATO")];
const stopped = [mk("x1","2026-03-05",7.99,"DISNEY PLUS"), mk("x2","2026-04-05",7.99,"DISNEY PLUS"), mk("x3","2026-05-05",7.99,"DISNEY PLUS")];
const all = [...netflix, ...gym, ...grocery, ...stopped];
const detected = S.detectSubscriptions(all, "2026-10-16");
add("subs.detect.mixed", "detectSubscriptions", { transactions: all, today: "2026-10-16" }, detected, "netflix: monthly with price change 12.99->13.99; gym annual; supermarket rejected (amount spread); disney 'fermo' (overdue > 7 grace days)");
const rows = [
  { id: "r1", key: detected[0]?.key ?? "x", status: "confermato", origin: "rilevato", name: null, amount: null, cadence: null, nextDate: null, categoryId: null },
  { id: "r2", key: "manual:affitto-box", status: "confermato", origin: "manuale", name: "Box auto", amount: 80, cadence: "mensile", nextDate: "2026-07-01", categoryId: null },
] as any;
const view = buildSubscriptionsView(detected, rows, "2026-10-16");
add("subs.view", "buildSubscriptionsView", { detected: "subs.detect.mixed.expected", rows, today: "2026-10-16" }, view, "manual row rolled forward until within grace");
add("subs.upcoming", "upcomingCharges", { items: "subs.view.expected.items", today: "2026-10-16" }, upcomingCharges(view.items, "2026-10-16").map(i => i.key));
add("subs.priceRises", "recentPriceRises", { items: "subs.view.expected.items", today: "2026-10-16" }, recentPriceRises(view.items, "2026-10-16").map(i => i.key));
writeFileSync(`${OUT}/subscriptions.json`, JSON.stringify({ topic: "subscriptions", source: "lib/calc/subscriptions.ts, lib/subscriptions/view.ts", vectors: V.splice(0) }, null, 2));
add("colors.distribute.3", "distributeColors", { categoryIds: ["a","b","c"] }, distributeColors(["a","b","c"]));
const ids = Array.from({ length: 50 }, (_, i) => `c${i}`);
const r = distributeColors(ids);
add("colors.distribute.50.tail", "distributeColors", { categoryIds: "c0..c49" }, { c46: r.c46, c47: r.c47, c48: r.c48, c49: r.c49 }, `pool size ${SWATCH_COLORS.length}; wraps cyclically`);
writeFileSync(`${OUT}/category-colors.json`, JSON.stringify({ topic: "category-colors", source: "lib/calc/distribute-colors.ts", swatchPool: SWATCH_COLORS, vectors: V.splice(0) }, null, 2));
console.log(JSON.stringify(detected.map(d=>({k:d.key,c:d.cadence,s:d.state,n:d.nextDate,conf:d.confidence,pc:d.priceChange})),null,0));
console.log(JSON.stringify(view.totals), SWATCH_COLORS.length);
