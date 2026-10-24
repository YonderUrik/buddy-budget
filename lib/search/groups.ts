/**
 * How the palette lays out the hits: the best one on top, then one block per kind of thing. Blocks are in a fixed order
 * (movements first, settings and actions last), so they never swap places while the user types and the server answers.
 */

import { SEARCH_GROUP_IDS, type SearchGroupId, type SearchHit } from "./types";

/** Block titles (Italian source keys). */
export const SEARCH_GROUP_TITLES: Record<SearchGroupId, string> = {
  movimenti: "Movimenti",
  conti: "Conti",
  titoli: "Titoli",
  categorie: "Categorie",
  abbonamenti: "Abbonamenti",
  debiti: "Debiti",
  obiettivi: "Obiettivi",
  pensione: "Pensione",
  pagine: "Pagine e impostazioni",
  azioni: "Azioni",
};

/** Max rows per block in the palette. */
const PER_GROUP = 5;

export interface SearchBlock {
  id: SearchGroupId | "top";
  hits: SearchHit[];
}

/** The best hit (a name matched from its start, never a movement among many) on top, then the blocks in their order. */
export function arrangeHits(hits: SearchHit[]): SearchBlock[] {
  const byGroup = new Map<SearchGroupId, SearchHit[]>();
  for (const hit of hits) byGroup.set(hit.group, [...(byGroup.get(hit.group) ?? []), hit]);
  const named = hits.filter((h) => h.group !== "movimenti" && h.group !== "azioni" && h.score === 3);
  const top = named.length > 0 ? named[0] : null;
  const blocks: SearchBlock[] = top ? [{ id: "top", hits: [top] }] : [];
  for (const id of SEARCH_GROUP_IDS) {
    const list = (byGroup.get(id) ?? []).filter((h) => h !== top).slice(0, PER_GROUP);
    if (list.length > 0) blocks.push({ id, hits: list });
  }
  return blocks;
}
