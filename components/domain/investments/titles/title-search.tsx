"use client";

/**
 * Ricerca di un titolo per nome, ticker o ISIN: trova quelli già noti (anche venduti, se hanno operazioni) e quelli di
 * mercato. Scegliere un risultato apre la pagina del titolo. `suggestions` propone i titoli del portafoglio prima di scrivere.
 */

import { useRouter } from "next/navigation";
import type { Instrument } from "@/lib/db/schema/investments";
import { InstrumentPicker } from "../instrument-picker";

export interface TitleSearchProps {
  currency: string;
  suggestions?: Instrument[];
  /** Base dell'indirizzo della pagina di un titolo (default `/investimenti/titoli`). */
  hrefBase?: string;
  /** Chiamata dopo la scelta, prima della navigazione (es. per un evento di prodotto). */
  onSelect?: (instrument: Instrument) => void;
}

export function TitleSearch({ currency, suggestions, hrefBase = "/investimenti/titoli", onSelect }: TitleSearchProps) {
  const router = useRouter();
  return (
    <InstrumentPicker
      value={null}
      defaultCurrency={currency}
      suggestions={suggestions}
      placeholder="Cerca un titolo"
      className="w-full sm:w-64"
      onChange={(instrument) => {
        onSelect?.(instrument);
        router.push(`${hrefBase}/${instrument.id}`);
      }}
    />
  );
}
