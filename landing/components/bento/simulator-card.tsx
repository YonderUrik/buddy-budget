"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { eur } from "@/lib/format";
import { estimateSale, TAX_RATE, type TaxInstrument } from "@/lib/tax";

/** Importo pagato e intervallo del valore attuale del simulatore (euro). */
const PAID = 10000;
const VALUE_MIN = 6000;
const VALUE_MAX = 18000;
const VALUE_STEP = 100;
const VALUE_START = 13000;

const INSTRUMENTS: readonly { id: TaxInstrument; label: string }[] = [
  { id: "azioni_etf", label: "Azioni e ETF" },
  { id: "titoli_stato", label: "Titoli di Stato" },
];

/** Versione semplificata del simulatore "Prima di vendere": cambia valore e strumento, vedi l'imposta stimata. */
export function SimulatorCard() {
  const [value, setValue] = useState(VALUE_START);
  const [instrument, setInstrument] = useState<TaxInstrument>("azioni_etf");
  const { gain, tax } = estimateSale(PAID, value, instrument);
  const rate = String(TAX_RATE[instrument]).replace(".", ",");
  const note =
    gain > 0
      ? `Aliquota ${rate}%. Stima semplificata, senza minusvalenze pregresse.`
      : gain < 0
        ? "Nessuna imposta. Una minusvalenza su azioni entra nello zaino e si compensa per 4 anni."
        : "Nessun guadagno, nessuna imposta.";

  return (
    <div className="vis sim">
      <div className="tgl" role="group" aria-label="Tipo di strumento">
        {INSTRUMENTS.map((i) => (
          <button
            key={i.id}
            type="button"
            aria-pressed={i.id === instrument}
            onClick={() => {
              setInstrument(i.id);
              track("simulator_used", { instrument: i.id });
            }}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div className="row"><span>Pagato</span><b>{eur(PAID)}</b></div>
      <label className="row" htmlFor="sim-value"><span>Vale oggi</span><b>{eur(value)}</b></label>
      <input
        id="sim-value"
        type="range"
        min={VALUE_MIN}
        max={VALUE_MAX}
        step={VALUE_STEP}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={() => track("simulator_used", { instrument })}
      />
      <div className="row"><span>{gain >= 0 ? "Guadagno" : "Perdita"}</span><b>{gain >= 0 ? "+" : "−"}{eur(Math.abs(gain))}</b></div>
      <div className="row key"><span>Imposta stimata</span><b>{eur(tax)}</b></div>
      <div className="note">{note}</div>
    </div>
  );
}
