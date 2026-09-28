"use client";

/**
 * Mini form "Non lo trovi?" del selettore strumenti. Un'obbligazione con ISIN valido si crea "solo ISIN" (prezzi da
 * Borsa Italiana); tutto il resto diventa uno strumento manuale, visibile solo a te, con prezzi inseriti a mano.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INSTRUMENT_TYPES, type InstrumentType } from "@/lib/db/schema/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { CreateInstrumentInput } from "@/lib/validation/investments";

export interface InstrumentManualFormProps {
  /** ISIN valido digitato nella ricerca, se c'è. */
  isin: string | null;
  defaultCurrency: string;
  pending: boolean;
  onCreate: (input: CreateInstrumentInput) => void;
}

export function InstrumentManualForm({ isin, defaultCurrency, pending, onCreate }: InstrumentManualFormProps) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<InstrumentType>(isin?.startsWith("IT") ? "obbligazione" : "fondo");
  const [currency, setCurrency] = React.useState(defaultCurrency);
  const fromBorsaItaliana = isin !== null && type === "obbligazione";
  const validCurrency = /^[A-Z]{3}$/.test(currency);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !validCurrency) return;
    onCreate(
      fromBorsaItaliana
        ? { source: "isin", isin: isin!, name: name.trim(), type, currency }
        : { source: "manuale", name: name.trim(), type, currency, ...(isin ? { isin } : {}) }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (es. BTP Valore 2029)" aria-label="Nome dello strumento" />
      <div className="flex gap-2">
        <Select value={type} onValueChange={(value) => value && setType(value as InstrumentType)}>
          <SelectTrigger className="flex-1" aria-label="Tipo di strumento">
            <SelectValue>{(value: string | null) => (value ? INSTRUMENT_TYPE_SINGULAR[value as InstrumentType] : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {INSTRUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {INSTRUMENT_TYPE_SINGULAR[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
          className="w-20"
          aria-label="Valuta (codice ISO, es. EUR)"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {fromBorsaItaliana
          ? `I prezzi arriveranno da Borsa Italiana (ISIN ${isin}).`
          : "Strumento visibile solo a te: i prezzi li inserisci a mano."}
      </p>
      <Button type="submit" size="sm" disabled={pending || !name.trim() || !validCurrency}>
        {pending ? "Aggiunta…" : "Aggiungi strumento"}
      </Button>
    </form>
  );
}
