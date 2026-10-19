"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Ricerca di un titolo per nome, ticker o ISIN: trova quelli già noti (anche venduti, se hanno operazioni) e quelli di
 * mercato. Scegliere un risultato apre la pagina del titolo. `suggestions` are the titles held today, offered before typing.
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
  const { t: tr } = useLocalization();
  const router = useRouter();
  return (
    <InstrumentPicker
      value={null}
      defaultCurrency={currency}
      suggestions={suggestions}
      placeholder={tr("Cerca un titolo")}
      className="w-full sm:w-64"
      onChange={(instrument) => {
        onSelect?.(instrument);
        router.push(`${hrefBase}/${instrument.id}`);
      }}
    />
  );
}
