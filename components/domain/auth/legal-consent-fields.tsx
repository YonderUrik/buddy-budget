"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SPECIFIC_CLAUSE_SECTIONS, legalHref } from "@/lib/legal";
import type { LegalConsentState } from "./use-legal-consent";

export interface LegalConsentFieldsProps {
  value: LegalConsentState;
  onChange: (next: LegalConsentState) => void;
  disabled?: boolean;
}

const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

/** Le tre dichiarazioni richieste per usare l'app: maggiore età, Termini e Privacy, approvazione specifica delle clausole. */
export function LegalConsentFields({ value, onChange, disabled }: LegalConsentFieldsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 text-sm text-text-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id="legal-age"
          checked={value.ageConfirmed}
          onCheckedChange={(checked) => onChange({ ...value, ageConfirmed: checked === true })}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor="legal-age" className="font-normal leading-snug">
          Dichiaro di avere almeno 18 anni.
        </Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="legal-terms"
          checked={value.termsAccepted}
          onCheckedChange={(checked) => onChange({ ...value, termsAccepted: checked === true })}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor="legal-terms" className="block font-normal leading-snug">
          Accetto i{" "}
          <a href={legalHref("termini")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Termini di servizio
          </a>{" "}
          e dichiaro di aver letto la{" "}
          <a href={legalHref("privacy")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Privacy
          </a>{" "}
          e l&apos;informativa sui{" "}
          <a href={legalHref("cookie")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            cookie
          </a>
          .
        </Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="legal-clauses"
          checked={value.specificClausesAccepted}
          onCheckedChange={(checked) => onChange({ ...value, specificClausesAccepted: checked === true })}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor="legal-clauses" className="font-normal leading-snug">
          Approvo in modo specifico, ai sensi degli artt. 1341 e 1342 del codice civile, le sezioni dei Termini: {SPECIFIC_CLAUSE_SECTIONS.join(", ")}.
        </Label>
      </div>
    </div>
  );
}
