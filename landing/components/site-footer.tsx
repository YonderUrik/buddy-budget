import "./site-footer.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SOURCE_LICENSE, SOURCE_URL, STATUS_URL, SUPPORT_EMAIL } from "@/content/site";
import { GithubMark } from "./github-mark";
import { SourceLink } from "./source-link";

/** Piè di pagina, lo stesso in ogni pagina: fondo navy come la sidebar dell'app, i rimandi principali, il codice e il supporto. */
export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="wrap">
        <span>© BuddyBudget</span>
        <nav aria-label="Pagine del sito">
          <Link href={CONTENT_PATHS.funzioni}>Funzioni</Link>
          <Link href={CONTENT_PATHS.schermate}>Schermate</Link>
          <Link href={CONTENT_PATHS.strumenti}>Calcolatori</Link>
          <Link href={CONTENT_PATHS.sicurezza}>Sicurezza</Link>
          <Link href={LEGAL_PATHS.privacy}>Privacy</Link>
          <Link href={LEGAL_PATHS.termini}>Termini</Link>
          <Link href={LEGAL_PATHS.cookie}>Cookie</Link>
        </nav>
        <span className="sp" />
        <nav aria-label="Codice, stato e supporto">
          {SOURCE_URL ? (
            <SourceLink className="gh" href={SOURCE_URL}>
              <GithubMark />
              GitHub · {SOURCE_LICENSE}
            </SourceLink>
          ) : null}
          <a href={STATUS_URL} target="_blank" rel="noopener noreferrer">Stato del servizio</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </nav>
      </div>
    </footer>
  );
}
