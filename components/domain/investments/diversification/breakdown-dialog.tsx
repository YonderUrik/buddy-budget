"use client";

/**
 * Dialog per correggere a mano area e settore di uno strumento. Parte dai valori in uso (automatici o già corretti);
 * una dimensione non toccata resta com'è, "Torna all'automatico" cancella la correzione di quella dimensione.
 */

import * as React from "react";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ExposureRow } from "@/lib/investments/analysis-view";
import { EXPOSURE_SOURCE_LABELS } from "@/lib/investments/exposure";
import { AREA_LABELS, MANUAL_AREA_KEYS, MANUAL_SECTOR_KEYS, SECTOR_LABELS } from "@/lib/investments/exposure-keys";
import { useUpdateBreakdownMutation } from "@/lib/queries/investments";
import { cn } from "@/lib/utils";

type Dimension = "areas" | "sectors";

const DIMENSION_OPTIONS = [
  { value: "areas", label: "Area geografica" },
  { value: "sectors", label: "Settore" },
] as const;

const KEYS: Record<Dimension, readonly string[]> = { areas: MANUAL_AREA_KEYS, sectors: MANUAL_SECTOR_KEYS };
const LABELS: Record<Dimension, Record<string, string>> = { areas: AREA_LABELS, sectors: SECTOR_LABELS };
/** Tolleranza sulla somma: i valori automatici arrotondati a un decimale possono superare 100 di qualche decimo. */
const SUM_TOLERANCE_PERCENT = 1;

/** Stato di una dimensione nel form: testi dei campi, se l'utente li ha toccati, se va riportata all'automatico. */
interface DimensionState {
  text: Record<string, string>;
  dirty: boolean;
  reset: boolean;
}

function toText(weights: Partial<Record<string, number>>, keys: readonly string[]): Record<string, string> {
  const text: Record<string, string> = {};
  for (const key of keys) {
    const weight = weights[key] ?? 0;
    text[key] = weight > 0 ? String(Math.round(weight * 1000) / 10).replace(".", ",") : "";
  }
  return text;
}

function parsePercent(text: string): number {
  const value = Number(text.replace(",", ".").trim() || "0");
  return Number.isFinite(value) ? value : NaN;
}

function initialState(row: ExposureRow): Record<Dimension, DimensionState> {
  return {
    areas: { text: toText(row.exposure.areas, KEYS.areas), dirty: false, reset: false },
    sectors: { text: toText(row.exposure.sectors, KEYS.sectors), dirty: false, reset: false },
  };
}

export interface BreakdownDialogProps {
  /** Strumento da correggere; null chiude il dialog. */
  row: ExposureRow | null;
  onClose: () => void;
}

export function BreakdownDialog({ row, onClose }: BreakdownDialogProps) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">{row ? <BreakdownForm key={row.instrument.id} row={row} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function BreakdownForm({ row, onClose }: { row: ExposureRow; onClose: () => void }) {
  const update = useUpdateBreakdownMutation();
  const [dimension, setDimension] = React.useState<Dimension>("areas");
  const [state, setState] = React.useState(() => initialState(row));
  const current = state[dimension];
  const source = dimension === "areas" ? row.exposure.areaSource : row.exposure.sectorSource;
  const sum = KEYS[dimension].reduce((s, key) => s + (parsePercent(current.text[key] ?? "") || 0), 0);
  // Si controllano solo le dimensioni toccate: le altre non si inviano come scritte.
  const invalid = (["areas", "sectors"] as const).some((d) => {
    if (!state[d].dirty) return false;
    const values = KEYS[d].map((key) => parsePercent(state[d].text[key] ?? ""));
    return values.some((v) => Number.isNaN(v) || v < 0) || values.reduce((s, v) => s + (v || 0), 0) > 100 + SUM_TOLERANCE_PERCENT;
  });

  function setValue(key: string, text: string) {
    setState((prev) => ({ ...prev, [dimension]: { text: { ...prev[dimension].text, [key]: text }, dirty: true, reset: false } }));
  }

  function resetDimension() {
    setState((prev) => ({ ...prev, [dimension]: { ...prev[dimension], dirty: false, reset: true } }));
  }

  /** Valore da inviare per una dimensione: null = automatico. */
  function payloadFor(d: Dimension): Record<string, number> | null {
    const s = state[d];
    if (s.reset) return null;
    if (!s.dirty) return row.manual?.[d] ?? null;
    const weights: Record<string, number> = {};
    for (const key of KEYS[d]) {
      const percent = parsePercent(s.text[key] ?? "");
      if (percent > 0) weights[key] = percent / 100;
    }
    // Un totale appena sopra 100 viene dagli arrotondamenti: si riporta a 100.
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total > 1) for (const key of Object.keys(weights)) weights[key] = weights[key] / total;
    return Object.keys(weights).length > 0 ? weights : null;
  }

  function save() {
    update.mutate(
      { instrumentId: row.instrument.id, input: { areas: payloadFor("areas"), sectors: payloadFor("sectors") } },
      { onSuccess: onClose }
    );
  }

  const isManual = source === "manuale" && !current.reset;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Correggi {row.instrument.name}</DialogTitle>
        <DialogDescription>
          Metti le percentuali che trovi nella scheda dell&apos;emittente (KID o sito del fondo). Quello che manca a 100% resta
          &ldquo;non classificato&rdquo;. La correzione vale solo per te.
        </DialogDescription>
      </DialogHeader>
      <SegmentedControl options={DIMENSION_OPTIONS} value={dimension} onChange={setDimension} ariaLabel="Cosa correggere" stretch />
      <p className="text-xs text-muted-foreground">
        {current.reset ? "Tornerà ai dati automatici quando salvi." : `Ora: ${EXPOSURE_SOURCE_LABELS[current.dirty ? "manuale" : source]}.`}
      </p>
      <div className="grid max-h-72 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto pr-1">
        {KEYS[dimension].map((key) => (
          <label key={key} className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span className="min-w-0 truncate">{LABELS[dimension][key]}</span>
            <span className="flex items-center gap-1">
              <Input
                inputMode="decimal"
                className="h-8 w-16 text-right tabular-nums"
                value={current.text[key] ?? ""}
                onChange={(e) => setValue(key, e.target.value)}
                aria-label={`${LABELS[dimension][key]} in percentuale`}
              />
              <span className="text-muted-foreground">%</span>
            </span>
          </label>
        ))}
      </div>
      <p className={cn("text-sm tabular-nums", sum > 100 + SUM_TOLERANCE_PERCENT ? "text-destructive" : "text-muted-foreground")}>
        Totale {sum.toFixed(1).replace(".", ",")}%
        {sum < 100 - SUM_TOLERANCE_PERCENT ? ` · non classificato ${(100 - sum).toFixed(1).replace(".", ",")}%` : ""}
      </p>
      {update.isError ? <p className="text-sm text-destructive">{update.error.message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isManual || current.dirty ? (
          <Button variant="ghost" className="text-muted-foreground" onClick={resetDimension} disabled={update.isPending}>
            Torna all&apos;automatico
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Annulla
          </Button>
          <Button onClick={save} disabled={invalid || update.isPending}>
            {update.isPending ? "Salvo…" : "Salva"}
          </Button>
        </div>
      </div>
    </>
  );
}
