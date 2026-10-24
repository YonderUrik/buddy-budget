import "./site-footer.css";
import Link from "next/link";
import { languageHrefs } from "@/content/locales";
import { INSTAGRAM_URL, SOURCE_LICENSE, SOURCE_URL, STATUS_URL, SUPPORT_EMAIL } from "@/content/site";
import { UI } from "@/content/ui";
import type { Locale } from "@/lib/i18n";
import { GithubMark } from "./github-mark";
import { InstagramMark } from "./instagram-mark";
import { LangSwitch } from "./lang-switch";
import { SocialLink } from "./social-link";
import { SourceLink } from "./source-link";

/** Name drawn across the footer, decorative (the brand is already in the bar). */
const WORDMARK = "BuddyBudget";

export interface SiteFooterProps {
  locale?: Locale;
  /** Target of the language menu for the other language: the same page there; default, that language's home. */
  alternate?: string;
}

/**
 * Footer, the same on every page, on the navy field: three columns above (the name, the main pages, language, code,
 * Instagram, status and support) and the name drawn across the whole width below, cut by the page's bottom edge (taste-skill
 * footer «Columns above, wordmark below»). Texts from `UI[locale]`.
 */
export function SiteFooter({ locale = "it", alternate }: SiteFooterProps) {
  const t = UI[locale];
  return (
    <footer className="sf" data-field="navy">
      <div className="wrap sf-cols">
        <p className="sf-name">© BuddyBudget</p>
        <nav aria-label={t.footer.pages}>
          {t.footer.links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <nav aria-label={t.footer.other}>
          <LangSwitch locale={locale} hrefs={languageHrefs(locale, undefined, alternate)} location="footer" label={t.language} />
          {SOURCE_URL ? (
            <SourceLink className="gh" href={SOURCE_URL}>
              <GithubMark />
              GitHub · {SOURCE_LICENSE}
            </SourceLink>
          ) : null}
          <SocialLink className="gh" href={INSTAGRAM_URL} network="instagram">
            <InstagramMark />
            Instagram
          </SocialLink>
          <a href={STATUS_URL} target="_blank" rel="noopener noreferrer">{t.footer.status}</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </nav>
      </div>
      <p className="sf-word" aria-hidden="true">{WORDMARK}</p>
    </footer>
  );
}
