import { legalHref } from "@/lib/legal";

export interface LegalLinksNoteProps {
  className?: string;
}

const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

/** Nota con i link a Termini e Privacy (aperti in una nuova scheda), da mettere sotto i pulsanti di accesso e onboarding. */
export function LegalLinksNote({ className = "text-center text-xs text-text-3" }: LegalLinksNoteProps) {
  return (
    <p className={className}>
      Continuando accetti i{" "}
      <a href={legalHref("termini")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        Termini di servizio
      </a>{" "}
      e confermi di aver letto la{" "}
      <a href={legalHref("privacy")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        Privacy
      </a>
      . Usiamo solo{" "}
      <a href={legalHref("cookie")} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        strumenti tecnici
      </a>
      .
    </p>
  );
}
