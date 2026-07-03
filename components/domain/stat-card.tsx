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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatAmount(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface StatCardProps {
  /** Etichetta descrittiva dell'importo (es. "Liquidità totale"). */
  label: string;
  /** Valore numerico in EUR. Negativo → rosso; positivo/zero → verde. */
  value: number;
  /** Testo secondario opzionale sotto il valore (es. "Aggiornato oggi"). */
  subtitle?: string;
  /** Classi CSS aggiuntive per la Card esterna. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StatCard({ label, value, subtitle, className }: StatCardProps) {
  const isNegative = value < 0;

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
            isNegative ? "text-neg" : "text-pos"
          )}
        >
          {formatAmount(value)}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
