import { SOURCES_CHECKED, type Source } from "@/content/seo-pages";

/** Fonti normative citate in una pagina, in un riquadro richiudibile (aperto da tastiera/clic) con la data dell'ultimo controllo. */
export function Sources({ items }: { items: readonly Source[] }) {
  return (
    <details className="sources sources-box">
      <summary>Fonti e riferimenti normativi ({items.length})</summary>
      <ul>
        {items.map((s) => (
          <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
        ))}
      </ul>
      <p className="note">Fonti controllate il {SOURCES_CHECKED}. Le norme cambiano: verifica sempre la versione in vigore o chiedi a un consulente.</p>
    </details>
  );
}
