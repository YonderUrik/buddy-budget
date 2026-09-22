/**
 * StatCard
 *
 * Card per la visualizzazione di un importo finanziario in evidenza.
 * Colora il valore in verde (positivo) o rosso (negativo) tramite i token
 * di tema `--pos` / `--neg`, senza valori hardcoded.
 *
 * Riusabilità: accetta qualsiasi `value` numerico e `label` stringa.
 * Non conosce nulla del dominio specifico (conti, spese, ecc.) — la
 * semantica è lasciata al chiamante.
 */

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface StatCardProps {
  /** Etichetta descrittiva dell'importo (es. "Liquidità totale"). */
  label: string;
  /** Valore numerico nella valuta indicata da `currency`. Negativo → rosso; positivo/zero → verde. */
  value: number;
  /** Codice valuta ISO 4217 (es. "EUR", "USD"). Default: "EUR". */
  currency?: string;
  /** Testo secondario opzionale sotto il valore (es. "Aggiornato oggi"). */
  subtitle?: string;
  /** Classi CSS aggiuntive per la Card esterna. */
  className?: string;
  /** Contenuto alternativo mostrato al posto del valore formattato in valuta (es. una percentuale); `value` resta usato per il colore verde/rosso. */
  valueOverride?: ReactNode;
  /**
   * Colore del valore. "auto" (default): verde se ≥0, rosso se <0. "neutral": colore testo normale,
   * per importi che non sono un giudizio (es. quanto hai speso). "pos"/"neg": forzati.
   */
  tone?: StatCardTone;
}

export type StatCardTone = "auto" | "neutral" | "pos" | "neg";

const TONE_CLASS: Record<Exclude<StatCardTone, "auto">, string> = {
  neutral: "text-foreground",
  pos: "text-pos",
  neg: "text-neg",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  currency = "EUR",
  subtitle,
  className,
  valueOverride,
  tone = "auto",
}: StatCardProps) {
  const resolvedTone = tone === "auto" ? (value < 0 ? "neg" : "pos") : tone;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "font-heading text-3xl font-medium tabular-nums",
            TONE_CLASS[resolvedTone]
          )}
        >
          {valueOverride ?? formatCurrency(value, currency, { maximumFractionDigits: 0 })}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
