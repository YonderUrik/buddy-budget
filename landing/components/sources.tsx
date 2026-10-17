import { SOURCES_CHECKED, type Source } from "@/content/seo-pages";
import { UI } from "@/content/ui";
import type { Locale } from "@/lib/i18n";

export interface SourcesProps {
  items: readonly Source[];
  /** Date of the last check, written in the page language. */
  checked?: string;
  summary?: string;
  locale?: Locale;
}

/** Legal sources cited on a page, in a folding box (opens with keyboard or click) with the date of the last check. */
export function Sources({ items, checked = SOURCES_CHECKED, summary, locale = "it" }: SourcesProps) {
  const t = UI[locale].sources;
  return (
    <details className="sources sources-box">
      <summary>{summary ?? t.summary} ({items.length})</summary>
      <ul>
        {items.map((s) => (
          <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
        ))}
      </ul>
      <p className="note">{t.checked} {checked}. {t.note}</p>
    </details>
  );
}
