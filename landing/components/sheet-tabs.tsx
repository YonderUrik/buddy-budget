import "./sheet-tabs.css";

export interface SheetTab {
  /** Id della sezione della pagina (ancora). */
  id: string;
  label: string;
}

/**
 * Indice delle sezioni della home nello stile delle schede dell'app, subito sotto l'apertura. Non resta fisso
 * mentre si scorre: è un punto di partenza, non una barra sempre visibile.
 */
export function SheetTabs({ tabs }: { tabs: readonly SheetTab[] }) {
  return (
    <nav className="stabs" aria-label="Sezioni della pagina">
      <div className="wrap">
        <div className="stabs-list">
          {tabs.map((t) => (
            <a key={t.id} href={`#${t.id}`}>{t.label}</a>
          ))}
        </div>
      </div>
    </nav>
  );
}
