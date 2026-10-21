"use client";

import type { FeatureArea } from "@/content/catalog.generated";
import { track } from "@/lib/analytics";
import type { ByRules } from "@/lib/visitor-country";
import { ByRulesText } from "./by-rules";

export interface AreaJumpItem {
  area: FeatureArea;
  /** Name shown, in the page language. */
  name: string;
  slug: string;
  /** Features shown to the visitor (fewer where some need rules their country lacks). */
  count: ByRules;
}

/** Row of shortcuts to the areas of the features page; the click counts as choosing an area. */
export function AreaJump({ areas, label = "Aree" }: { areas: readonly AreaJumpItem[]; label?: string }) {
  return (
    <nav className="fa-jump" aria-label={label}>
      {areas.map((a) => (
        <a key={a.slug} href={`#${a.slug}`} onClick={() => track("catalog_area_selected", { area: a.area })}>
          {a.name}
          <small><ByRulesText text={a.count} /></small>
        </a>
      ))}
    </nav>
  );
}
