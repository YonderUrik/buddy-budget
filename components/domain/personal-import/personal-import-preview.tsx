"use client";

/** Dettaglio dell'analisi di un file CSV personale la cui importazione non è riuscita: righe, esiti e valori originali. */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchCheckIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/components/privacy-provider";
import { personalImportApi } from "./personal-import-api";
import type { Preview } from "@/lib/personal-import/confirm";

export function PersonalImportPreview({ id }: { id: string }) {
  const { hidden } = usePrivacy();
  const [page, setPage] = useState(0);
  const { data, error, isPending } = useQuery({ queryKey: ["personal-import-preview", id], queryFn: () => personalImportApi<Preview>(`/${id}`), staleTime: 0 });
  if (isPending) return <p role="status">Caricamento anteprima…</p>;
  if (error || !data) return <p role="alert">{error?.message ?? "Anteprima non disponibile"}</p>;
  if (hidden) return <p className="text-sm text-muted-foreground">Disattiva «Nascondi gli importi» per consultare il dettaglio.</p>;
  const financial = data.records.filter(r => ["cash", "investment"].includes(r.outcome.kind));
  const ignored = data.records.filter(r => r.outcome.kind === "ignore").length;
  return <PanelSection icon={SearchCheckIcon} title="Dettaglio dell’analisi" color="var(--swatch-amber)" className="gap-4">
    <p className="text-sm text-muted-foreground">{data.records.length} righe analizzate · {financial.length} operazioni · {ignored} escluse. Apri il dettaglio delle righe per confrontare i valori originali.</p>
    <p className="text-sm">Verranno creati un conto dedicato e, se necessario, un portafoglio. Il saldo partirà da zero: carica lo storico completo oppure correggi il saldo del conto dopo l’importazione. Gli strumenti creati avranno prezzi manuali.</p>
    <p className="text-sm text-muted-foreground">Le righe identiche già importate con questo formato verranno saltate. File con descrizioni o colonne modificate possono produrre doppioni: confrontali con lo storico. I cambi storici convertono i movimenti in {data.currency}.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Riga</th><th className="p-2">Risultato</th><th className="p-2">Data</th><th className="p-2">Dettaglio</th></tr></thead><tbody>{data.records.slice(page * 50, (page + 1) * 50).map(r => {
      const o = r.outcome;
      return <tr key={r.key} className="border-b align-top"><td className="p-2">{r.line ?? o.row + 2}</td><td className="p-2">{o.kind === "cash" ? o.transfer ? "Giroconto" : "Movimento" : o.kind === "investment" ? o.type : o.kind === "ignore" ? "Esclusa" : "Errore"}</td><td className="whitespace-nowrap p-2">{"date" in o ? o.date : "—"}</td><td className="min-w-64 p-2">
        {o.kind === "cash" ? <>{o.description} · <strong>{o.amount.toLocaleString("it-IT", { style: "currency", currency: o.currency })}</strong></> : o.kind === "investment" ? <>{o.name} ({o.isin ?? "senza ISIN"}, {o.instrumentType}) · {o.quantity} × {o.price} {o.currency}{o.grossAmount !== null ? ` · Lordo ${o.grossAmount}` : ""} · Commissioni {o.fees} · Imposte {o.taxes}</> : o.reason}
        {r.rate !== null && <p className="text-xs text-muted-foreground">Cambio verso {data.currency}: {r.rate}</p>}
        <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Riga originale</summary><dl className="mt-2 space-y-1">{r.source.map((value, i) => <div key={i}><dt className="inline font-medium">{data.headers[i] ?? `Colonna ${i + 1}`}: </dt><dd className="inline break-all">{value}</dd></div>)}</dl></details>
      </td></tr>;
    })}</tbody></table></div>
    <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Precedenti</Button><span className="text-sm">{page + 1} / {Math.max(1, Math.ceil(data.records.length / 50))}</span><Button variant="outline" disabled={(page + 1) * 50 >= data.records.length} onClick={() => setPage(p => p + 1)}>Successive</Button></div>
  </PanelSection>;
}
