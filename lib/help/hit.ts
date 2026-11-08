/** The «Cerca» row for help: one answer card with the AI's short answer or the first article, and links to the others. */

import type { SearchHit } from "@/lib/search/types";
import { helpArticle } from "./articles";

/** A help answer for `ids` (known ones, best first): found by the rules, or the AI's `text` written from them; null without any. */
export function helpHit(ids: readonly string[], source: "regole" | "ai", text: string | null = null): SearchHit | null {
  const first = ids.length > 0 ? helpArticle(ids[0]) : undefined;
  if (!first) return null;
  return {
    key: `aiuto:${ids.join(",")}`,
    group: "risposte",
    icon: "aiuto",
    title: first.question,
    href: first.quickAdd ? undefined : first.href,
    quickAdd: first.quickAdd,
    answer: { kind: "aiuto", source, articles: [...ids], text: text || null },
    score: 3,
  };
}
