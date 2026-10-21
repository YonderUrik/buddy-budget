import { localizedFormats } from "@/lib/localization/format";
import { localizedDebtFormats } from "@/components/domain/debts/debts-format";
import { splitMoney } from "@/components/domain/net-worth/money-hero";
import { translate } from "@/lib/localization/messages";
import { writeFileSync } from "node:fs";
const V: any[] = [];
const add = (id: string, fn: string, input: any, expected: any, notes = "") => V.push({ id, function: fn, input, expected, ...(notes ? { notes } : {}) });
for (const loc of ["it-IT","en-GB","de-DE"]) {
  const f = localizedFormats(loc);
  for (const [v,c] of [[1234.5,"EUR"],[-1234.5,"EUR"],[0,"EUR"],[12345.678,"EUR"],[1234567.891,"EUR"],[999.999,"EUR"],[10,"USD"],[10,"GBP"],[1234.5,"CHF"],[0.005,"EUR"],[-0.004,"EUR"]] as const) add(`currency.${loc}.${v}.${c}`, "formatCurrency", { value: v, currency: c, locale: loc }, f.formatCurrency(v,c));
  add(`currency.${loc}.maxFD0`, "formatCurrency", { value: 1234.5, currency: "EUR", locale: loc, maximumFractionDigits: 0 }, f.formatCurrency(1234.5,"EUR",{maximumFractionDigits:0}));
  for (const c of ["EUR","USD","GBP","CHF"]) add(`symbol.${loc}.${c}`, "getCurrencySymbol", { currency: c, locale: loc }, f.getCurrencySymbol(c));
  for (const v of [0.1234,-0.05,0,1.5]) { add(`pct.${loc}.${v}`, "formatPct", { value: v, digits: 1, locale: loc }, f.formatPct(v)); add(`pct0.${loc}.${v}`, "formatPct", { value: v, digits: 0, locale: loc }, f.formatPct(v,0)); }
  for (const v of [0.1234,-0.05,0]) add(`signedPct.${loc}.${v}`, "formatSignedPct", { value: v, locale: loc }, f.formatSignedPct(v));
  for (const v of [250,-250,0]) add(`signedCurrency.${loc}.${v}`, "formatSignedCurrency", { value: v, currency: "EUR", locale: loc }, f.formatSignedCurrency(v,"EUR"));
  for (const v of [1.23456,123.456,-9.87654]) add(`price.${loc}.${v}`, "formatPrice", { value: v, currency: "USD", locale: loc }, f.formatPrice(v,"USD"));
  for (const v of [999,1234,15300,2500000,1.2e9]) add(`compact.${loc}.${v}`, "formatCompactAmount", { value: v, locale: loc }, f.formatCompactAmount(v));
  add(`ratio.${loc}`, "formatRatio", { value: 1234.5, digits: 1, locale: loc }, f.formatRatio(1234.5));
  for (const m of [1,3,5,6,7,9,12]) add(`shortMonth.${loc}.${m}`, "shortMonthLabel", { month: m, locale: loc }, f.shortMonthLabel(m));
  add(`monthLabel.${loc}`, "formatMonthLabel", { key: "2026-03", locale: loc }, f.formatMonthLabel("2026-03"));
  add(`shortDate.${loc}`, "formatShortDate", { iso: "2026-09-26", locale: loc }, f.formatShortDate("2026-09-26"));
  add(`dateWithYear.${loc}`, "formatDateWithYear", { iso: "2026-09-26", locale: loc }, f.formatDateWithYear("2026-09-26"));
  add(`longDate.${loc}`, "formatLongDate", { date: "2026-10-29", locale: loc }, f.formatLongDate(new Date(2026,9,29)));
  const now = new Date("2026-07-26T12:00:00Z");
  for (const ms of [30e3, 5*60e3, 3*3600e3, 25*3600e3, 2*86400e3, 10*86400e3]) add(`relative.${loc}.${ms}`, "formatRelativeTime", { msAgo: ms, now: now.toISOString(), locale: loc }, f.formatRelativeTime(new Date(now.getTime()-ms), now));
  add(`splitMoney.${loc}`, "splitMoney", { value: 1234.5, currency: "EUR", locale: loc }, splitMoney(1234.5, "EUR", loc));
}
for (const l of ["it","en","de"] as const) { const d = localizedDebtFormats(l); for (const m of [0,1,12,13,25,60]) add(`duration.${l}.${m}`, "formatDuration", { months: m, language: l }, d.formatDuration(m)); }
for (const [l, s, v] of [["en",'Ricollega a "{0}"',{0:"Conto corrente"}],["de",'Ricollega a "{0}"',{0:"Conto corrente"}],["it",'Ricollega a "{0}"',{0:"Conto corrente"}],["en","{month}: finora hai speso ",{month:"October"}],["de","Chiave inesistente {x}",{x:1}]] as const) add(`translate.${l}.${s}`, "translate", { language: l, source: s, values: v }, translate(l as any, s, v as any), "missing key falls back to the Italian source; unknown placeholders are left as-is");
writeFileSync(process.argv[2], JSON.stringify({ topic: "formatting", source: "lib/format.ts, lib/localization/format.ts, lib/localization/messages.ts, components/domain/debts/debts-format.ts", generatedWith: { node: process.version, icu: process.versions.icu, cldr: (process.versions as any).cldr, tz: "Europe/Rome" }, conventions: "Strings are compared byte-exact. Watch U+00A0 (no-break space), U+202F (narrow no-break space), U+2212 (minus sign) and U+2013 (en dash).", vectors: V }, null, 2));
console.log(V.length);
