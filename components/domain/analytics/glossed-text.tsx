"use client";

/** Testo in cui la prima occorrenza di ogni termine del glossario diventa un `Term` (le altre restano testo normale). */

import * as React from "react";
import { GLOSSARY_MATCHES, type GlossaryId } from "./glossary";
import { Term } from "./term";

export interface GlossedTextProps {
  text: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${GLOSSARY_MATCHES.map((m) => escapeRegExp(m.phrase)).join("|")})(?![\\p{L}\\p{N}])`, "giu");
const ID_BY_PHRASE = new Map(GLOSSARY_MATCHES.map((m) => [m.phrase, m.id] as const));

/** Spezza `text` in testo e termini; ogni termine del glossario è sottolineato una volta sola. */
export function GlossedText({ text }: GlossedTextProps) {
  const parts = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    const seen = new Set<GlossaryId>();
    let last = 0;
    for (const m of text.matchAll(PATTERN)) {
      const id = ID_BY_PHRASE.get(m[1].toLowerCase());
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(text.slice(last, m.index));
      out.push(
        <Term key={`${id}-${m.index}`} id={id}>
          {m[1]}
        </Term>
      );
      last = m.index + m[1].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text]);
  return <>{parts}</>;
}
