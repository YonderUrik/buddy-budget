/**
 * Card "Numeri chiave" (da Yahoo): per le azioni multipli (P/E, P/B), dividendo, margini e crescita; per ETF e fondi
 * costo annuo e patrimonio. Mostra solo le voci disponibili e dice cosa significano; se la fonte non risponde lo dice.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { formatPct } from "../percent";
import { formatCompactAmount, formatRatio } from "./title-format";

interface Row {
  label: string;
  value: string;
  hint: string;
}

/** Voci disponibili, nell'ordine di lettura. Pura, per poterla testare. */
export function fundamentalsRows(f: TitleFundamentals, currency: string): Row[] {
  const rows: (Row | null)[] = [
    f.expenseRatio !== null ? { label: "Costo annuo (TER)", value: formatPct(f.expenseRatio, 2), hint: "Quanto costa tenerlo ogni anno, già scalato dal prezzo." } : null,
    f.totalAssets !== null ? { label: "Patrimonio gestito", value: `${formatCompactAmount(f.totalAssets)} ${currency}`, hint: "Più è grande, di solito più è facile comprarlo e venderlo." } : null,
    f.marketCap !== null ? { label: "Capitalizzazione", value: `${formatCompactAmount(f.marketCap)} ${currency}`, hint: "Valore di mercato dell'intera azienda." } : null,
    f.trailingPE !== null ? { label: "P/E", value: formatRatio(f.trailingPE), hint: "Anni di utili necessari a ripagare il prezzo, ai ritmi di oggi." } : null,
    f.forwardPE !== null ? { label: "P/E atteso", value: formatRatio(f.forwardPE), hint: "Lo stesso calcolo sugli utili previsti dagli analisti." } : null,
    f.priceToBook !== null ? { label: "Prezzo / patrimonio (P/B)", value: formatRatio(f.priceToBook), hint: "Sotto 1 costa meno del patrimonio contabile dell'azienda." } : null,
    f.eps !== null ? { label: "Utile per azione", value: `${formatRatio(f.eps, 2)} ${currency}`, hint: "Utile degli ultimi 12 mesi diviso il numero di azioni." } : null,
    f.dividendYield !== null ? { label: "Rendimento da dividendo", value: formatPct(f.dividendYield, 2), hint: "Dividendo annuo diviso il prezzo attuale." } : null,
    f.profitMargin !== null ? { label: "Margine di profitto", value: formatPct(f.profitMargin), hint: "Quanto resta di utile su ogni 100 di ricavi." } : null,
    f.returnOnEquity !== null ? { label: "Redditività del capitale (ROE)", value: formatPct(f.returnOnEquity), hint: "Utile in rapporto al capitale degli azionisti." } : null,
    f.revenueGrowth !== null ? { label: "Crescita dei ricavi", value: formatPct(f.revenueGrowth), hint: "Rispetto allo stesso periodo dell'anno prima." } : null,
    f.debtToEquity !== null ? { label: "Debiti / capitale", value: formatRatio(f.debtToEquity / 100, 2), hint: "Sopra 1 l'azienda ha più debiti che capitale proprio." } : null,
    f.beta !== null ? { label: "Beta", value: formatRatio(f.beta, 2), hint: "Sopra 1 si muove più del mercato, sotto 1 meno." } : null,
  ];
  return rows.filter((r): r is Row => r !== null);
}

export interface TitleFundamentalsCardProps {
  fundamentals: TitleFundamentals | null;
  status: "ok" | "unsupported" | "unavailable";
  currency: string;
}

export function TitleFundamentalsCard({ fundamentals, status, currency }: TitleFundamentalsCardProps) {
  if (status === "unsupported") return null;
  const rows = fundamentals ? fundamentalsRows(fundamentals, currency) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Numeri chiave</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === "unavailable"
              ? "Yahoo non ha risposto o non ha questi dati per il titolo. Riprova più tardi."
              : "Nessun dato disponibile per questo titolo."}
          </p>
        ) : (
          <>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="text-base font-medium tabular-nums text-foreground">{row.value}</dd>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Fonte: Yahoo Finance, aggiornata una volta al giorno. Dati non ufficiali, da usare come orientamento.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
