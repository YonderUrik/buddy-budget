import { writeFileSync } from "node:fs";
const out = { generatedWith: { node: process.version, icu: process.versions.icu, cldr: process.versions.cldr }, locales: {} };
const parts = (loc, opts, v) => new Intl.NumberFormat(loc, opts).formatToParts(v);
for (const loc of ["it-IT", "en-GB", "de-DE"]) {
  const L = {};
  const p = parts(loc, {}, 12345.6);
  L.decimal = p.find(x => x.type === "decimal").value;
  L.group = p.find(x => x.type === "group")?.value ?? null;
  L.minimumGroupingDigits = new Intl.NumberFormat(loc).format(1234).includes(L.group) ? 1 : 2;
  L.minusSign = parts(loc, {}, -1).find(x => x.type === "minusSign").value;
  L.percentPattern = new Intl.NumberFormat(loc, { style: "percent" }).format(0.12).replace("12", "#");
  L.currency = {};
  for (const c of ["EUR", "USD", "GBP", "CHF"]) {
    const s = new Intl.NumberFormat(loc, { style: "currency", currency: c }).format(1).replace(/1([.,]00)?/, "#");
    const sym = new Intl.NumberFormat(loc, { style: "currency", currency: c }).formatToParts(1).find(x => x.type === "currency").value;
    L.currency[c] = { pattern: s, symbol: sym };
  }
  L.compact = {};
  for (const v of [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e12]) L.compact[v] = new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const fmt = (o) => (d) => new Intl.DateTimeFormat(loc, o).format(d);
  L.monthsLong = [...Array(12)].map((_, i) => fmt({ month: "long" })(new Date(2026, i, 1)));
  L.monthsShort = [...Array(12)].map((_, i) => fmt({ month: "short" })(new Date(2026, i, 1)));
  L.monthsShortInDate = [...Array(12)].map((_, i) => fmt({ day: "numeric", month: "short" })(new Date(2026, i, 1)));
  L.weekdaysLong = [...Array(7)].map((_, i) => fmt({ weekday: "long" })(new Date(2026, 9, 12 + i)));
  L.weekdaysShort = [...Array(7)].map((_, i) => fmt({ weekday: "short" })(new Date(2026, 9, 12 + i)));
  const sample = new Date(2026, 8, 6);
  const skeletons = {
    "d MMM": { day: "numeric", month: "short" }, "d MMM y": { day: "numeric", month: "short", year: "numeric" },
    "d MMMM y": { day: "numeric", month: "long", year: "numeric" }, "d MMMM": { day: "numeric", month: "long" },
    "MMMM y": { month: "long", year: "numeric" }, "MMM y": { month: "short", year: "numeric" }, "MMM yy": { month: "short", year: "2-digit" },
    "d MMM yy": { day: "numeric", month: "short", year: "2-digit" }, "dd MMM y": { day: "2-digit", month: "short", year: "numeric" },
    "EEEE d MMMM": { weekday: "long", day: "numeric", month: "long" }, "EEEE d MMMM y": { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    "EEE d MMMM y": { weekday: "short", day: "numeric", month: "long", year: "numeric" }, "HH:mm": { hour: "2-digit", minute: "2-digit" },
  };
  L.dateSkeletonsSample = { date: "2026-09-06T14:05 (Sunday)", outputs: Object.fromEntries(Object.entries(skeletons).map(([k, o]) => [k, fmt(o)(new Date(2026, 8, 6, 14, 5))])) };
  L.listConjunction2 = new Intl.ListFormat(loc, { style: "long", type: "conjunction" }).format(["A", "B"]);
  out.locales[loc] = L;
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
