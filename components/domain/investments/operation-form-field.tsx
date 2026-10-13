/** Campo del form operazione: etichetta sopra, controllo (ed eventuale testo d'aiuto) sotto. */

import * as React from "react";

export interface OperationFormFieldProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function OperationFormField({ label, htmlFor, children }: OperationFormFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
