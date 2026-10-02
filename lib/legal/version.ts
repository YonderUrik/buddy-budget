/**
 * Versione dei documenti legali (Termini e Privacy) in vigore. Va tenuta uguale a `LEGAL_VERSION` di
 * `landing/content/legal.ts` (lo controlla `landing/content/legal.test.ts`): cambiandola, tutti gli utenti
 * devono accettare di nuovo al prossimo accesso.
 */
export const LEGAL_VERSION = "2026-10-02";

/** Sezioni dei Termini da approvare in modo specifico (art. 1341 c.c.), mostrate accanto alla casella dedicata. */
export const SPECIFIC_CLAUSE_SECTIONS = ["Responsabilità", "Sospensione e chiusura", "Modifiche ai termini"] as const;

/** True se l'utente non ha ancora accettato la versione in vigore dei documenti. */
export function needsLegalAcceptance(acceptedVersion: string | null | undefined, current: string = LEGAL_VERSION): boolean {
  return acceptedVersion !== current;
}
