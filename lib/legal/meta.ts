import { z } from "zod";
import { LANGUAGES, type Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { LEGAL_LINKS, PRIVACY_EMAIL } from "./links";
import { LEGAL_VERSION, SPECIFIC_CLAUSE_SECTIONS } from "./version";

/** Response of the public `GET /api/legal`: what a client needs to show and accept the current legal documents. */
export const legalMetaSchema = z.object({
  version: z.string(),
  language: z.enum(LANGUAGES),
  specificClauseSections: z.array(z.string()),
  documents: z.array(z.object({ id: z.enum(["privacy", "termini", "cookie"]), label: z.string(), url: z.url() })),
  privacyEmail: z.string(),
});

export type LegalMeta = z.infer<typeof legalMetaSchema>;

/** Current legal version, the clauses to approve specifically and the document links, with labels in `language`. */
export function legalMeta(language: Language): LegalMeta {
  return {
    version: LEGAL_VERSION,
    language,
    specificClauseSections: SPECIFIC_CLAUSE_SECTIONS.map((section) => translate(language, section)),
    documents: LEGAL_LINKS.map((link) => ({ id: link.id, label: translate(language, link.label), url: link.href })),
    privacyEmail: PRIVACY_EMAIL,
  };
}
