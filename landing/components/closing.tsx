import "./closing.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { CLOSING } from "@/content/sheet";
import { APP_LINKS, SOURCE_LICENSE, SOURCE_URL } from "@/content/site";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { Reveal } from "./reveal";
import { SourceLink } from "./source-link";
import { TrackedSection } from "./tracked-section";

/** Chiusura: il foglio si chiude (la formula =CHIUDI), invito a creare l'account e piè di pagina. */
export function Closing({ content = CLOSING }: { content?: typeof CLOSING }) {
  return (
    <TrackedSection id="fine" section="fine" className="end">
      <div className="wrap">
        <Reveal className="end-panel cell">
          <div>
            <code className="end-fx">{content.formula}</code>
            <h2>{content.title}</h2>
            <p className="end-note">{content.note}</p>
          </div>
          <div className="cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="closing" target="signup">
              Crea un account gratis{ARROW_ICON}
            </CtaLink>
            <CtaLink className="btn ghost" href={APP_LINKS.login} location="closing" target="login">Accedi</CtaLink>
          </div>
        </Reveal>
        <footer className="end-foot">
          <span>© BuddyBudget · creato da Daniele</span>
          <span>Le schermate del sito usano dati di esempio inventati</span>
          {SOURCE_URL && (
            <span>
              Open source ({SOURCE_LICENSE}) · <SourceLink href={SOURCE_URL}>Vedi il codice</SourceLink>
            </span>
          )}
          <nav aria-label="Strumenti e guide">
            <Link href={CONTENT_PATHS.funzioni}>Funzioni</Link>
            <Link href={CONTENT_PATHS.schermate}>Schermate</Link>
            <Link href={CONTENT_PATHS.zainetto}>Zainetto fiscale</Link>
            <Link href={CONTENT_PATHS.ammortamento}>Ammortamento</Link>
            <Link href={CONTENT_PATHS.guidaZainetto}>Guida</Link>
          </nav>
          <nav aria-label="Documenti legali">
            <Link href={LEGAL_PATHS.privacy}>Privacy</Link>
            <Link href={LEGAL_PATHS.termini}>Termini</Link>
            <Link href={LEGAL_PATHS.cookie}>Cookie</Link>
          </nav>
        </footer>
      </div>
    </TrackedSection>
  );
}
