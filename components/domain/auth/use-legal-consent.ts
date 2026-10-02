import * as React from "react";
import { LEGAL_VERSION, type LegalAcceptanceInput } from "@/lib/legal";

export interface LegalConsentState {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  specificClausesAccepted: boolean;
}

const EMPTY_CONSENT: LegalConsentState = { ageConfirmed: false, termsAccepted: false, specificClausesAccepted: false };

/** Stato delle caselle di accettazione: `complete` quando sono tutte spuntate, `payload` è il corpo da inviare al server. */
export function useLegalConsent() {
  const [consent, setConsent] = React.useState<LegalConsentState>(EMPTY_CONSENT);
  const complete = consent.ageConfirmed && consent.termsAccepted && consent.specificClausesAccepted;
  const payload = React.useMemo(
    () => (complete ? ({ version: LEGAL_VERSION, ageConfirmed: true, termsAccepted: true, specificClausesAccepted: true } satisfies LegalAcceptanceInput) : null),
    [complete]
  );
  return { consent, setConsent, complete, payload };
}
