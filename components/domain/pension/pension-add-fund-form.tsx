"use client";

/** Form per aggiungere un fondo di previdenza: nome e data di prima adesione a una forma pensionistica. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PensionAddFundFormProps {
  /** Data di oggi `YYYY-MM-DD`: limite massimo della data di adesione. */
  today: string;
  onSubmit: (input: { name: string; adhesionDate: string }) => void;
  pending?: boolean;
  errorMessage?: string | null;
  /** Nome proposto all'inizio. */
  defaultName?: string;
}

export function PensionAddFundForm({ today, onSubmit, pending = false, errorMessage = null, defaultName = "" }: PensionAddFundFormProps) {
  const [name, setName] = React.useState(defaultName);
  const [adhesionDate, setAdhesionDate] = React.useState("");
  const canSubmit = name.trim() !== "" && adhesionDate !== "" && !pending;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit({ name: name.trim(), adhesionDate });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          Nome del fondo
          <Input value={name} placeholder="es. Piano pensione Moneyfarm" maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          Prima adesione a una forma pensionistica
          <Input type="date" value={adhesionDate} max={today} onChange={(e) => setAdhesionDate(e.target.value)} />
          <span>Conta la prima in assoluto, anche in un&apos;altra azienda: decide l&apos;aliquota in uscita.</span>
        </label>
      </div>
      {errorMessage ? <p role="alert" className="text-sm text-neg">{errorMessage}</p> : null}
      <div>
        <Button type="submit" disabled={!canSubmit}>{pending ? "Salvataggio…" : "Aggiungi il fondo"}</Button>
      </div>
    </form>
  );
}
