"use client";

import { useState } from "react";
import Link from "next/link";
import { useBrokerStatementsQuery } from "@/lib/queries/investments";
import type { BrokerStatement } from "@/lib/investments/import/broker-statement";
import { formatCurrency } from "@/lib/format";

/** Broker's reported closing figures; never mix them with today's estimated market values. */
export function BrokerStatements({ compact = false }: { compact?: boolean }) {
  const query = useBrokerStatementsQuery();
  const [selected, setSelected] = useState("");
  if (query.isLoading) return compact ? null : <p>Caricamento rendiconti…</p>;
  if (query.isError) return <p role="alert">Impossibile leggere i rendiconti. <button onClick={() => query.refetch()}>Riprova</button></p>;
  const documents = query.data?.statements ?? [];
  if (!documents.length) return compact ? null : <div className="space-y-3"><Link href="/investimenti/rendiconti/importazioni" className="text-sm underline">Gestisci importazioni</Link><p className="text-sm text-muted-foreground">Importa un Activity Statement per vedere saldi, movimenti di cassa e posizioni riconciliati con il broker.</p></div>;
  const document = documents.find((s) => s.id === selected) ?? documents[0];
  const s = document.statement;
  const total = s.nav.find((r) => r.label === "Total")?.value ?? 0;
  if (compact) return <section className="rounded-xl border p-4 text-sm"><Link href="/investimenti/rendiconti" className="font-medium underline">Rendiconti Interactive Brokers</Link><p>Ultima chiusura {s.to}: {formatCurrency(total, s.currency)} · include cassa, titoli e ratei. <span className="text-muted-foreground">Per il confronto con IBKR usa i rendiconti; le altre schede usano prezzi correnti e costo medio ponderato.</span></p></section>;
  return <section className="flex flex-col gap-5">
    <Link href="/investimenti/rendiconti/importazioni" className="text-sm font-medium underline">Gestisci importazioni</Link>
    <label className="text-sm">Rendiconto <select className="ml-2 rounded border bg-background p-2" value={document.id} onChange={(e) => setSelected(e.target.value)}>{documents.map((d) => <option key={d.id} value={d.id}>{d.statement.from} – {d.statement.to} · conto …{d.statement.account.slice(-4)}</option>)}</select></label>
    <p className="text-sm text-muted-foreground">Valori comunicati dal broker alla chiusura, nella valuta indicata. Non sono prezzi di oggi né stime fiscali italiane. I lotti e le rettifiche storiche del broker possono differire dal costo medio usato nelle altre schede.</p>
    <div className="grid gap-3 sm:grid-cols-3">{s.nav.filter((r) => ["Total", "Cash", "Stock"].includes(r.label)).map((r) => <div className="rounded-xl border p-4" key={r.label}><p className="text-sm text-muted-foreground">{r.label === "Total" ? "Valore netto del conto" : r.label === "Cash" ? "Liquidità (anche a debito)" : "Titoli"}</p><p className="text-xl font-medium tabular-nums">{formatCurrency(r.value, s.currency)}</p></div>)}</div>
    <ReportTable title="Composizione del valore netto" headers={["Voce", `Importo (${s.currency})`]} rows={s.nav.map((r) => [r.label, formatCurrency(r.value, s.currency)])} />
    <ReportTable title="Posizioni alla chiusura" headers={["Titolo", "Valuta", "Quote", "Prezzo", "Valore", "Costo broker", "P/L non realizzato"]} rows={s.positions.map((p) => [p.symbol, p.currency, String(p.quantity), formatCurrency(p.price, p.currency, { maximumFractionDigits: 6 }), formatCurrency(p.value, p.currency), formatCurrency(p.costBasis, p.currency), formatCurrency(p.unrealized, p.currency)])} />
    <ReportTable title="Riconciliazione liquidità" headers={["Valuta", "Saldo iniziale", "Saldo finale", "Scarto movimenti"]} rows={s.cash.map((c) => [c.currency, formatCurrency(c.opening, c.currency), formatCurrency(c.closing, c.currency), formatCurrency(c.difference, c.currency, { maximumFractionDigits: 6 })])} />
    <CashLedger statement={s} />
    <details><summary className="cursor-pointer text-sm font-medium">Risultati realizzati e non realizzati del broker</summary><ReportTable title="P/L dichiarato nel rendiconto" headers={["Titolo", "Voce", "Importo (valuta del rendiconto se non specificata)"]} rows={s.performance.flatMap((r) => Object.entries(r.values).map(([label, n]) => [r.symbol, label, formatCurrency(n, r.currency ?? s.currency, { maximumFractionDigits: 6 })]))} /></details>
  </section>;
}

/** Scrollable table keeps complete report data accessible on small screens. */
function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section><h2 className="mb-2 text-sm font-medium">{title}</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs"><thead><tr>{headers.map((h) => <th className="whitespace-nowrap bg-muted/50 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr className="border-t" key={i}>{row.map((v, j) => <td className="whitespace-nowrap p-2 tabular-nums" key={j}>{v}</td>)}</tr>)}</tbody></table></div></section>;
}

/** Ledger entries already included in trade commissions remain visible without being charged twice. */
function CashLedger({ statement }: { statement: BrokerStatement }) {
  return <details><summary className="cursor-pointer text-sm font-medium">Movimenti di cassa ({statement.ledger.length})</summary><ReportTable title="Movimenti nelle valute originali" headers={["Data", "Tipo", "Descrizione", "Valuta", "Importo", "Nota"]} rows={statement.ledger.map((r) => [r.date, r.kind, r.description, r.currency, formatCurrency(r.amount, r.currency, { maximumFractionDigits: 6 }), r.includedInCommission ? "Già incluso nelle commissioni" : ""])} /></details>;
}
