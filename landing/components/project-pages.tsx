import "./project-pages.css";
import Link from "next/link";
import { HOME_PATH } from "@/content/locales";
import { FOUNDER, repoLinks, type ProjectContent } from "@/content/project";
import { SOURCE_URL, STATUS_URL, SUPPORT_EMAIL } from "@/content/site";
import { projectActivity, readChangelog, type ChangeLine } from "@/lib/changelog";
import { longDate } from "@/lib/format";
import { ContentPage } from "./content-page";

/** A link of the pages: a site path, or a key of `repoLinks` (dropped when the build has no public repository). */
function resolve(href: string): { href: string; external: boolean } | null {
  if (href.startsWith("/")) return { href, external: false };
  if (!SOURCE_URL) return null;
  const links = repoLinks(SOURCE_URL) as Record<string, string>;
  return links[href] ? { href: links[href], external: true } : null;
}

/** Contact lines of `/about`, per language. */
const CONTACT = {
  it: { title: "Come contattare Daniele", email: "Email", profile: "GitHub", status: "Stato del servizio" },
  en: { title: "How to reach Daniele", email: "Email", profile: "GitHub", status: "Service status" },
} as const;

/**
 * `/about` and `/en/about`: who builds BuddyBudget, by name, why it exists, how it is made, since when (from the
 * changelog), who contributed and who answers for the data, then the contacts. No photo and no social profile other
 * than GitHub: only what Daniele has chosen to show.
 */
export function AboutPage({ content, path }: { content: ProjectContent; path: string }) {
  const { locale, about } = content;
  const releases = readChangelog();
  const activity = releases ? projectActivity(releases) : null;
  const contact = CONTACT[locale];
  return (
    <ContentPage title={about.title} lead={about.lead} crumbs={[{ href: HOME_PATH[locale], label: "BuddyBudget" }, { label: about.title }]} ctaTitle={about.ctaTitle} ctaText={about.ctaText} ctaLocation="about" current={path} disclaimer={false} locale={locale}>
      {about.sections(activity).map((section) => {
        const links = (section.links ?? []).map((l) => ({ ...l, to: resolve(l.href) })).filter((l) => l.to);
        return (
          <section key={section.title} className="pj-sec">
            <h2>{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {links.length > 0 ? (
              <p className="pj-links">
                {links.map((l) =>
                  l.to!.external ? (
                    <a key={l.label} href={l.to!.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
                  ) : (
                    <Link key={l.label} href={l.to!.href}>{l.label}</Link>
                  ),
                )}
              </p>
            ) : null}
          </section>
        );
      })}
      <section className="pj-sec">
        <h2>{contact.title}</h2>
        <dl className="pj-contact">
          <div><dt>{contact.email}</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></dd></div>
          <div><dt>{contact.profile}</dt><dd><a href={FOUNDER.profile} target="_blank" rel="noopener noreferrer">{FOUNDER.handle}</a></dd></div>
          <div><dt>{contact.status}</dt><dd><a href={STATUS_URL} target="_blank" rel="noopener noreferrer">{STATUS_URL.replace(/^https:\/\//, "")}</a></dd></div>
        </dl>
      </section>
    </ContentPage>
  );
}

/** Pull request of a line, linked when the repository is public. */
function PrLink({ line, label }: { line: ChangeLine; label: string }) {
  if (!line.pr) return null;
  if (!SOURCE_URL) return <span className="pj-pr">#{line.pr}</span>;
  return (
    <a className="pj-pr" href={`${SOURCE_URL}/pull/${line.pr}`} target="_blank" rel="noopener noreferrer" aria-label={`${label} #${line.pr}`}>
      #{line.pr}
    </a>
  );
}

/**
 * `/changelog` and `/en/changelog`: every release of `CHANGELOG.md`, newest first, with its date and one line per
 * change (features, fixes, speed-ups; dependency bumps and refactors left out). Releases with nothing left to show
 * keep their place in the count, not in the list. Without the file it points to the releases on GitHub.
 */
export function ChangelogPage({ content, path }: { content: ProjectContent; path: string }) {
  const { locale, changelog } = content;
  const releases = readChangelog();
  const activity = releases ? projectActivity(releases) : null;
  const shown = (releases ?? []).filter((r) => r.changes.length > 0);
  const github = SOURCE_URL ? repoLinks(SOURCE_URL).releases : null;
  return (
    <ContentPage title={changelog.title} lead={changelog.lead(activity)} crumbs={[{ href: HOME_PATH[locale], label: "BuddyBudget" }, { label: changelog.title }]} ctaTitle={changelog.ctaTitle} ctaText={changelog.ctaText} ctaLocation="changelog" current={path} disclaimer={false} locale={locale}>
      {shown.length > 0 ? (
        <>
          <p className="pj-note">
            {changelog.note}
            {github ? (
              <>
                {" "}
                <a href={github} target="_blank" rel="noopener noreferrer">{changelog.github}</a>
              </>
            ) : null}
          </p>
          <ol className="pj-log">
            {shown.map((r) => (
              <li key={r.version} className="pj-rel">
                <h2>
                  <time dateTime={r.date}>{longDate(r.date, locale)}</time>
                  <span>{r.version}</span>
                </h2>
                <ul>
                  {r.changes.map((c) => (
                    <li key={`${c.kind}-${c.text}`} data-kind={c.kind}>
                      <span className="pj-kind">{changelog.kinds[c.kind]}</span>
                      <span className="pj-text">
                        {c.text} <PrLink line={c} label={changelog.pr} />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>
          {changelog.missing}{" "}
          {github ? <a href={github} target="_blank" rel="noopener noreferrer">{changelog.github}</a> : null}
        </p>
      )}
    </ContentPage>
  );
}
