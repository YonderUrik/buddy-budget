"use client";

/**
 * Campo prezzo del form operazione, precompilato col prezzo dello strumento alla data scelta. Sotto dice da dove
 * viene il valore; se l'utente l'ha cambiato e il prezzo proposto è diverso, offre di ripristinarlo.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { OperationFormField } from "./operation-form-field";

export interface OperationPriceFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Frase su da dove viene il prezzo proposto (o perché manca); null per non mostrare nulla. */
  hint: string | null;
  /** Prezzo proposto da offrire con "Usa" quando il valore nel campo è diverso; null per non offrirlo. */
  restoreValue: string | null;
  onRestore: () => void;
}

export function OperationPriceField({ id, label, value, onChange, hint, restoreValue, onRestore }: OperationPriceFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <OperationFormField label={label} htmlFor={id}>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? hintId : undefined} />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground" aria-live="polite">
          {hint}
          {restoreValue ? (
            <>
              {" · "}
              <button type="button" onClick={onRestore} className="font-medium text-foreground underline underline-offset-2">
                Usa {restoreValue}
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </OperationFormField>
  );
}
