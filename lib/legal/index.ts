/** lib/legal — barrel file: indirizzi dei documenti legali, versione in vigore e dichiarazione di accettazione. Il codice solo-server sta in `./acceptance`. */
export { LANDING_URL, LEGAL_LINKS, legalHref } from "./links";
export type { LegalDocumentId, LegalLink } from "./links";
export { LEGAL_VERSION, SPECIFIC_CLAUSE_SECTIONS, needsLegalAcceptance } from "./version";
export { isValidLegalAcceptance, legalAcceptanceSchema } from "./acceptance-input";
export type { LegalAcceptanceInput } from "./acceptance-input";
