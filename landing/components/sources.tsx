import { SOURCES_CHECKED, type Source } from "@/content/seo-pages";

/** Elenco delle fonti normative citate in una pagina, con la data dell'ultimo controllo. */
export function Sources({ items }: { items: readonly Source[] }) {
  return (
    <section className="sources" aria-labelledby="fonti">
      <h2 id="fonti">Fonti</h2>
      <ul>
        {items.map((s) => (
          <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
        ))}
      </ul>
      <p className="note">Fonti controllate il {SOURCES_CHECKED}. Le norme cambiano: verifica sempre la versione in vigore o chiedi a un consulente.</p>
    </section>
  );
}
