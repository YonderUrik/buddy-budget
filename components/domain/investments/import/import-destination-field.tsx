"use client";

/** Scelta del portafoglio di destinazione quando il rendiconto può finire in più portafogli (DEGIRO). */

import * as React from "react";
import { WalletIcon } from "lucide-react";

export interface ImportDestinationFieldProps {
  portfolios: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function ImportDestinationField({ portfolios, value, onChange }: ImportDestinationFieldProps) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <WalletIcon className="size-4 text-muted-foreground" aria-hidden="true" /> In quale portafoglio lo metto?
      </label>
      <select id={id} className="h-10 rounded-lg border bg-background px-3 text-sm sm:max-w-xs" value={value || (portfolios.length === 1 ? portfolios[0].id : "")} onChange={(e) => onChange(e.target.value)}>
        {portfolios.length > 1 ? <option value="">Scegli un portafoglio</option> : null}
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
