/** Campo di un form di Debiti: etichetta sopra, controllo e testo d'aiuto sotto. */

import * as React from "react";

export interface DebtFormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

export function DebtFormField({ label, htmlFor, hint, children }: DebtFormFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
