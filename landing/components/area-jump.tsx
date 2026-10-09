"use client";

import type { FeatureArea } from "@/content/catalog.generated";
import { track } from "@/lib/analytics";

export interface AreaJumpItem {
  area: FeatureArea;
  slug: string;
  count: number;
}

/** Riga di scorciatoie verso le aree della pagina funzioni; il clic è contato come scelta di un'area. */
export function AreaJump({ areas }: { areas: readonly AreaJumpItem[] }) {
  return (
    <nav className="fa-jump" aria-label="Aree">
      {areas.map((a) => (
        <a key={a.slug} href={`#${a.slug}`} onClick={() => track("catalog_area_selected", { area: a.area })}>
          {a.area}
          <small>{a.count}</small>
        </a>
      ))}
    </nav>
  );
}
