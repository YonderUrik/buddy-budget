"use client";

/** Stato vuoto di Pensione: spiega cosa fa la sezione e fa aggiungere il primo fondo. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PensionAddFundForm, type PensionAddFundFormProps } from "./pension-add-fund-form";

export type PensionEmptyStateProps = Pick<PensionAddFundFormProps, "today" | "onSubmit" | "pending" | "errorMessage">;

export function PensionEmptyState(props: PensionEmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg font-medium">Aggiungi il tuo fondo pensione</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ti basta inserire, ogni tanto, i due numeri che vedi nell&apos;area clienti del fondo: contributi netti e controvalore. Da lì calcoliamo rendimento, quanto ti resterebbe prelevando oggi, il confronto col TFR in azienda e dove arriverai.
        </p>
      </CardHeader>
      <CardContent>
        <PensionAddFundForm {...props} />
      </CardContent>
    </Card>
  );
}
