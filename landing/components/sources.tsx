import { SOURCES_CHECKED, type Source } from "@/content/seo-pages";

/** Fonti normative citate in una pagina, in un riquadro richiudibile (aperto da tastiera/clic) con la data dell'ultimo controllo. */
export function Sources({ items, checked = SOURCES_CHECKED, summary = "Fonti e riferimenti normativi" }: { items: readonly Source[]; checked?: string; summary?: string }) {
  return (
    <details className="sources sources-box">
      <summary>{summary} ({items.length})</summary>
      <ul>
        {items.map((s) => (
          <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
        ))}
      </ul>
      <p className="note">Fonti controllate il {checked}. Le norme cambiano: verifica sempre la versione in vigore o chiedi a un consulente.</p>
    </details>
  );
}
