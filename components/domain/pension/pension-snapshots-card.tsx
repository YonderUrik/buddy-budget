"use client";

/**
 * Inserimento delle fotografie del fondo: l'utente riporta ogni tanto i due valori che vede nell'area clienti
 * (contributi netti e controvalore) e il resto lo calcola l'app. Elenco delle fotografie con il versamento ricavato.
 */

import * as React from "react";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sortSnapshots, type PensionSnapshot } from "@/lib/calc/pension";
import { formatLongDateKey, formatShortDateKey, money } from "./pension-format";

export interface PensionSnapshotsCardProps {
  snapshots: PensionSnapshot[];
  currency: string;
  /** Data di oggi `YYYY-MM-DD`, usata come default del form. */
  today: string;
  /** Salva la fotografia; la promessa rifiutata porta il messaggio d'errore da mostrare. */
  onAdd: (snapshot: Omit<PensionSnapshot, "id">) => Promise<void>;
  onRemove: (id: string) => void;
  /** Apre l'import da file; senza, il pulsante non compare. */
  onImport?: () => void;
}

const LIST_VISIBLE_ROWS = 6;

const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(value) && value >= 0 ? value : null;
};

export function PensionSnapshotsCard({ snapshots, currency, today, onAdd, onRemove, onImport }: PensionSnapshotsCardProps) {
  const [date, setDate] = React.useState(today);
  const [contributions, setContributions] = React.useState("");
  const [value, setValue] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const parsedContributions = parseAmount(contributions);
  const parsedValue = parseAmount(value);
  const canSave = parsedContributions !== null && parsedValue !== null && date !== "";
  const sorted = sortSnapshots(snapshots);
  const rows = [...sorted].reverse();
  const visible = showAll ? rows : rows.slice(0, LIST_VISIBLE_ROWS);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ date, netContributions: parsedContributions, value: parsedValue });
      setContributions("");
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aggiorna i valori del fondo</CardTitle>
        <p className="text-sm text-muted-foreground">Riporta i due numeri che vedi nell&apos;area clienti, ogni volta che vuoi (di solito dopo ogni versamento del TFR). Il versamento lo ricaviamo noi dalla differenza. Se esiste già una fotografia con la stessa data, viene sostituita.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Data
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Contributi netti
            <Input inputMode="decimal" placeholder="es. 10.880" value={contributions} onChange={(e) => setContributions(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Controvalore
            <Input inputMode="decimal" placeholder="es. 11.420" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <Button type="submit" disabled={!canSave || saving}>{saving ? "Salvo…" : "Aggiungi"}</Button>
        </form>
        {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
        {onImport ? (
          <p className="text-sm text-muted-foreground">
            Hai già uno storico?{" "}
            <button type="button" onClick={onImport} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
              <Upload size={14} aria-hidden="true" /> Importa da file CSV o Excel
            </button>
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="flex flex-col">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 border-b border-border pb-1.5 text-xs text-muted-foreground">
              <span>Data</span><span className="text-right">Versamento</span><span className="text-right">Contributi netti</span><span className="text-right">Controvalore</span><span className="w-7" />
            </div>
            {visible.map((snapshot) => {
              const previous = sorted[sorted.findIndex((s) => s.id === snapshot.id) - 1];
              const delta = previous ? snapshot.netContributions - previous.netContributions : null;
              return (
                <div key={snapshot.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-border/60 py-1.5 text-sm tabular-nums last:border-b-0">
                  <span className="truncate text-foreground">{formatShortDateKey(snapshot.date)}</span>
                  <span className="text-right text-pos">{delta !== null && delta > 0 ? `+${money(delta, currency)}` : "—"}</span>
                  <span className="text-right text-muted-foreground">{money(snapshot.netContributions, currency)}</span>
                  <span className="text-right text-foreground">{money(snapshot.value, currency)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Elimina la fotografia del ${formatLongDateKey(snapshot.date)}`} onClick={() => onRemove(snapshot.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            {rows.length > LIST_VISIBLE_ROWS ? (
              <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Mostra meno" : `Mostra tutte (${rows.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
