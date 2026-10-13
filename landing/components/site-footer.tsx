import "./site-footer.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { STATUS_URL } from "@/content/site";

/** Piè di pagina delle pagine secondarie: stessi rimandi e stesso aspetto del piè di pagina della home. */
export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="wrap">
        <span>© BuddyBudget</span>
        <nav aria-label="Strumenti e guide">
          <Link href={CONTENT_PATHS.funzioni}>Funzioni</Link>
          <Link href={CONTENT_PATHS.schermate}>Schermate</Link>
          <Link href={CONTENT_PATHS.risparmio}>Obiettivo di risparmio</Link>
          <Link href={CONTENT_PATHS.zainetto}>Zainetto fiscale</Link>
          <Link href={CONTENT_PATHS.ammortamento}>Ammortamento</Link>
          <Link href={CONTENT_PATHS.guidaZainetto}>Guida</Link>
        </nav>
        <nav aria-label="Documenti legali">
          <Link href={CONTENT_PATHS.sicurezza}>Sicurezza</Link>
          <Link href={LEGAL_PATHS.privacy}>Privacy</Link>
          <Link href={LEGAL_PATHS.termini}>Termini</Link>
          <Link href={LEGAL_PATHS.cookie}>Cookie</Link>
            <a href={STATUS_URL} target="_blank" rel="noopener noreferrer">Stato del servizio</a>
        </nav>
      </div>
    </footer>
  );
}
