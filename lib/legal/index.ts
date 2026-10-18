/** lib/legal — barrel file: legal document links, current version and acceptance statement. Server-only code lives in `./acceptance`; the API metadata (`./meta`, which pulls in the translation catalogs) is imported directly so client bundles stay light. */
export { LANDING_URL, LEGAL_LINKS, PRIVACY_EMAIL, legalHref } from "./links";
export type { LegalDocumentId, LegalLink } from "./links";
export { LEGAL_VERSION, SPECIFIC_CLAUSE_SECTIONS, needsLegalAcceptance } from "./version";
export { isValidLegalAcceptance, legalAcceptanceSchema } from "./acceptance-input";
export type { LegalAcceptanceInput } from "./acceptance-input";
export { PRIVACY_REQUEST_OPTIONS, buildPrivacyRequestHref } from "./requests";
export type { PrivacyRequestOption, PrivacyRequestType } from "./requests";
