import { t as trLanding } from "@/lib/localization";
import "./site-footer.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SOURCE_LICENSE, SOURCE_URL, STATUS_URL, SUPPORT_EMAIL } from "@/content/site";
import { GithubMark } from "./github-mark";
import { SourceLink } from "./source-link";

/** Pagina di Logo.dev, citata sotto i loghi degli strumenti (condizione del piano gratuito). */
const LOGO_CREDIT_URL = "https://logo.dev";

/** Piè di pagina, lo stesso in ogni pagina: fondo navy come la sidebar dell'app, i rimandi principali, il codice e il supporto. */
export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="wrap">
        <span>{trLanding("© BuddyBudget")}</span>
        <nav aria-label={trLanding("Pagine del sito")}>
          <Link href={CONTENT_PATHS.funzioni}>{trLanding("Funzioni")}</Link>
          <Link href={CONTENT_PATHS.schermate}>{trLanding("Schermate")}</Link>
          <Link href={CONTENT_PATHS.strumenti}>{trLanding("Calcolatori")}</Link>
          <Link href={CONTENT_PATHS.sicurezza}>{trLanding("Sicurezza")}</Link>
          <Link href={LEGAL_PATHS.privacy}>{trLanding("Privacy")}</Link>
          <Link href={LEGAL_PATHS.termini}>{trLanding("Termini")}</Link>
          <Link href={LEGAL_PATHS.cookie}>{trLanding("Cookie")}</Link>
        </nav>
        <span className="sp" />
        <nav aria-label={trLanding("Codice, stato e supporto")}>
          {SOURCE_URL ? (
            <SourceLink className="gh" href={SOURCE_URL}>
              <GithubMark />{trLanding("GitHub · ")}{trLanding(SOURCE_LICENSE)}
            </SourceLink>
          ) : null}
          <a href={LOGO_CREDIT_URL} target="_blank" rel="noopener noreferrer">{trLanding("Loghi forniti da Logo.dev")}</a>
          <a href={STATUS_URL} target="_blank" rel="noopener noreferrer">{trLanding("Stato del servizio")}</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{trLanding(SUPPORT_EMAIL)}</a>
        </nav>
      </div>
    </footer>
  );
}
