import Link from "next/link";
import type { HoodText, TrustText } from "@/content/home";
import { SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { rise } from "@/lib/motion/rise";
import { GithubMark } from "../github-mark";
import { SourceLink } from "../source-link";
import { TrackedSection } from "../tracked-section";
import { CopyCommand } from "./copy-command";

interface TrustRow {
  what: string;
  how: string;
  source?: { href: string; label: string; external: boolean };
}

/** One group of the table: its name is printed once, on its first row; a blank row separates the groups. */
function Group({ name, rows, last }: { name: string; rows: readonly TrustRow[]; last?: boolean }) {
  return (
    <tbody>
      {rows.map((row, i) => (
        <tr key={row.what}>
          <th scope="row" className="tg-name">{i === 0 ? name : <span className="sr">{name}</span>}</th>
          <td className="tg-what">{row.what}</td>
          <td className="tg-how">{row.how}</td>
          <td className="tg-src">
            {row.source ? (
              <a href={row.source.href} target={row.source.external ? "_blank" : undefined} rel={row.source.external ? "noopener noreferrer" : undefined}>
                {row.source.label}
              </a>
            ) : null}
          </td>
        </tr>
      ))}
      {last ? null : (
        <tr className="tg-gap" aria-hidden="true">
          <td colSpan={4} />
        </tr>
      )}
    </tbody>
  );
}

/**
 * «Legge soltanto. Non sposta soldi.»: what happens to the data, the limits and the code as one table with no lines
 * (taste-skill section «Recognition as a table»: groups instead of years, alternate rows on a tone step), then the
 * code itself: the links to read it and the commands to run it at home.
 */
export function Trust({ text, hood }: { text: TrustText; hood: HoodText }) {
  const facts: TrustRow[] = text.facts.map((f) => ({ what: f.title, how: f.text, source: f.source ? { ...f.source, external: true } : undefined }));
  const limits: TrustRow[] = text.limits.map((l) => ({ what: l.title, how: l.text }));
  const code: TrustRow[] = hood.facts.map((f) => ({
    what: f.label,
    how: f.value,
    source: SOURCE_URL && f.path ? { href: `${SOURCE_URL}${f.path}`, label: "GitHub", external: true } : undefined,
  }));
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec trust" field="light" aria-labelledby="sicurezza-t">
      <div className="wrap">
        <h2 id="sicurezza-t" className="stepped" data-rise>
          <span>{text.title[0]}</span> <span>{text.title[1]}</span>
        </h2>
        <div className="tt" data-rise style={rise(1)}>
          <table>
            <caption className="sr">{`${text.title[0]} ${text.title[1]}`}</caption>
            <thead className="sr">
              <tr>
                <th scope="col">{text.columns.group}</th>
                <th scope="col">{text.columns.what}</th>
                <th scope="col">{text.columns.how}</th>
                <th scope="col">{text.columns.source}</th>
              </tr>
            </thead>
            <Group name={text.groups.facts} rows={facts} />
            <Group name={text.groups.limits} rows={limits} />
            <Group name={text.groups.code} rows={code} last />
          </table>
        </div>
        <Link className="more" href={text.moreHref}>{text.more}</Link>
        <TrackedSection id="codice" section="codice" as="div" className="code" aria-labelledby="codice-t">
          <div data-rise>
            <h3 id="codice-t">{hood.title}</h3>
            <p>{SOURCE_URL ? hood.text : hood.fallback}</p>
            {SOURCE_URL ? (
              <div className="cta">
                <SourceLink className="btn ink" href={SOURCE_URL} location="sezione">
                  <GithubMark />
                  {hood.cta}
                </SourceLink>
                <a className="btn line" href={`${SOURCE_URL}${hood.selfHostPath}`} target="_blank" rel="noopener noreferrer">{hood.selfHost}</a>
              </div>
            ) : null}
            <p className="who">
              {hood.who} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> {hood.whoTail}
            </p>
          </div>
          {SOURCE_URL ? (
            <div data-rise style={rise(1)}>
              <CopyCommand label={hood.command.label} lines={[`git clone ${SOURCE_URL}.git`, ...hood.command.lines]} copy={hood.command.copy} copied={hood.command.copied} />
            </div>
          ) : null}
        </TrackedSection>
      </div>
    </TrackedSection>
  );
}
