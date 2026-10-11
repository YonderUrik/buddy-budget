"use client";

/** Stato vuoto di Pensione: spiega cosa fa la sezione e fa aggiungere il primo fondo. */

import { UmbrellaIcon } from "lucide-react";
import { PensionAddFundForm, type PensionAddFundFormProps } from "./pension-add-fund-form";
import { PensionSection } from "./pension-section";

export type PensionEmptyStateProps = Pick<PensionAddFundFormProps, "today" | "onSubmit" | "pending" | "errorMessage">;

export function PensionEmptyState(props: PensionEmptyStateProps) {
  return (
    <PensionSection
      icon={UmbrellaIcon}
      title="Aggiungi il tuo fondo pensione"
      color="var(--swatch-teal)"
      description="Ti basta inserire, ogni tanto, i due numeri che vedi nell'area clienti del fondo: contributi netti e controvalore. Da lì calcoliamo rendimento, quanto ti resterebbe prelevando oggi, il confronto col TFR in azienda e dove arriverai."
    >
      <PensionAddFundForm {...props} />
    </PensionSection>
  );
}
