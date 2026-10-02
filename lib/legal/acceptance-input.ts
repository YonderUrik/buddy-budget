import { z } from "zod";
import { LEGAL_VERSION } from "./version";

/** Dichiarazioni richieste per accettare i documenti legali: maggiore età, Termini/Privacy e clausole specifiche, sulla versione in vigore. */
export const legalAcceptanceSchema = z.object({
  version: z.literal(LEGAL_VERSION),
  ageConfirmed: z.literal(true),
  termsAccepted: z.literal(true),
  specificClausesAccepted: z.literal(true),
});

export type LegalAcceptanceInput = z.infer<typeof legalAcceptanceSchema>;

/** True se `value` è una dichiarazione completa di accettazione della versione in vigore. */
export function isValidLegalAcceptance(value: unknown): value is LegalAcceptanceInput {
  return legalAcceptanceSchema.safeParse(value).success;
}
