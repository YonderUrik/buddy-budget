"use client";

import type { FeatureArea } from "@/content/catalog.generated";
import { track } from "@/lib/analytics";

export interface AreaJumpItem {
  area: FeatureArea;
  /** Name shown, in the page language. */
  name: string;
  slug: string;
  count: number;
}

/** Row of shortcuts to the areas of the features page; the click counts as choosing an area. */
export function AreaJump({ areas, label = "Aree" }: { areas: readonly AreaJumpItem[]; label?: string }) {
  return (
    <nav className="fa-jump" aria-label={label}>
      {areas.map((a) => (
        <a key={a.slug} href={`#${a.slug}`} onClick={() => track("catalog_area_selected", { area: a.area })}>
          {a.name}
          <small>{a.count}</small>
        </a>
      ))}
    </nav>
  );
}
