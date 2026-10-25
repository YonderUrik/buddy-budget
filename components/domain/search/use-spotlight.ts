"use client";

/**
 * State of the «Cerca» panel, apart from how it looks: what the user typed turned into blocks of results, the draft a
 * sentence describes («comprato 3 Apple a 50 € oggi»), and «Chiedi all'AI» for the sentences the rules cannot read.
 * Pages and settings are matched in the browser at each keystroke; the user's data comes from `/api/search` after a
 * pause in typing; the AI is asked only when the user picks its row.
 */

import * as React from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { parseCommand, type CommandDraft } from "@/lib/commands";
import type { Instrument } from "@/lib/db/schema/investments";
import { useLocalization } from "@/lib/localization/provider";
import { track } from "@/lib/analytics";
import { arrangeHits, SEARCH_GROUP_TITLES } from "@/lib/search/groups";
import { foldText, matchScore } from "@/lib/search/normalize";
import { searchStatic, staticEntriesOf } from "@/lib/search/static-index";
import type { SearchGroupId, SearchHit, SearchResponse } from "@/lib/search/types";

/** Pause in typing before asking the server (the static part does not wait). */
export const SEARCH_DEBOUNCE_MS = 180;
/** Characters before the server is asked. */
const SERVER_MIN_LENGTH = 2;
/** A sentence worth offering to the AI: a few words, not a name. */
const AI_MIN_WORDS = 3;
const AI_MIN_LENGTH = 10;

/** Narrowing chosen with the round buttons beside the bar (desktop) before typing. */
export const SPOTLIGHT_FILTERS = ["movimenti", "investimenti", "impostazioni", "aggiungi"] as const;
export type SpotlightFilter = (typeof SPOTLIGHT_FILTERS)[number];

const FILTER_GROUPS: Record<SpotlightFilter, SearchGroupId[]> = {
  movimenti: ["movimenti", "conti", "categorie", "abbonamenti"],
  investimenti: ["titoli"],
  impostazioni: ["pagine"],
  aggiungi: ["azioni"],
};

export type AiStatus = "idle" | "loading" | "ok" | "none" | "invalid" | "disabled" | "unavailable" | "limited" | "failed";

export type SpotlightItem =
  | { type: "hit"; key: string; hit: SearchHit }
  | { type: "command"; key: "command"; draft: CommandDraft; instrument: Instrument | null }
  | { type: "ai"; key: "ai"; status: AiStatus };

export interface SpotlightBlock {
  id: string;
  /** Italian source key; null for a block without a title (the AI row). */
  title: string | null;
  items: SpotlightItem[];
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(`search ${response.status}`);
  return response.json();
}

/** `/api/search` for a folded query, shared by the results and by the security a sentence names. */
function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => fetchSearch(query, signal),
    enabled: query.length >= SERVER_MIN_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export interface UseSpotlightInput {
  text: string;
  filter: SpotlightFilter | null;
  /** Blocks shown before typing (recent picks, shortcuts). */
  idle: SpotlightBlock[];
}

export function useSpotlight({ text, filter, idle }: UseSpotlightInput) {
  const { t: tr, productCountry, language } = useLocalization();
  const query = foldText(text);
  const serverQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const server = useSearch(serverQuery);

  // The rules read the sentence at every keystroke; an AI answer replaces them only for the sentence it was asked about.
  const ruleDraft = React.useMemo(() => (filter && filter !== "aggiungi" ? null : parseCommand(text)), [text, filter]);
  const [ai, setAi] = React.useState<{ sentence: string; status: AiStatus; draft: CommandDraft | null }>({ sentence: "", status: "idle", draft: null });
  const aiForText = ai.sentence === text.trim() ? ai : null;
  const draft = aiForText?.draft ?? ruleDraft;
  const needsInstrument = draft !== null && (draft.kind === "acquisto" || draft.kind === "vendita" || draft.kind === "dividendo");
  const subject = needsInstrument ? foldText(draft.subject) : "";
  const subjectSearch = useSearch(subject);
  // Only a security whose name starts with what was typed («Ap» is not SAP), also while an older answer is still shown.
  const instrument = needsInstrument
    ? (subjectSearch.data?.hits.find((h) => h.group === "titoli" && h.instrument && Math.max(matchScore(h.title, subject), h.instrument.isin?.toLowerCase() === subject ? 3 : 0) >= 2)?.instrument ?? null)
    : null;

  const askAi = useMutation({
    mutationFn: async (sentence: string) => {
      const response = await fetch("/api/commands/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence, language, today: localToday() }),
      });
      if (!response.ok) return { status: "failed" as AiStatus, draft: null };
      return (await response.json()) as { status: AiStatus; draft?: CommandDraft };
    },
    onMutate: (sentence) => setAi({ sentence, status: "loading", draft: null }),
    onSuccess: (result, sentence) => {
      track("search_ai_asked", { outcome: result.status });
      setAi({ sentence, status: result.status, draft: result.draft ?? null });
    },
    onError: (_error, sentence) => setAi({ sentence, status: "failed", draft: null }),
  });

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const offerAi = !filter && (draft === null || draft.guessed) && words >= AI_MIN_WORDS && text.trim().length >= AI_MIN_LENGTH && aiForText?.status !== "ok";

  const blocks = React.useMemo<SpotlightBlock[]>(() => {
    if (query === "") {
      if (filter === "impostazioni") return [{ id: "filtro", title: "Impostazioni", items: staticEntriesOf("impostazione", productCountry, (k) => tr(k)).map((hit) => ({ type: "hit", key: hit.key, hit })) }];
      if (filter === "aggiungi") return [{ id: "filtro", title: "Aggiungi", items: staticEntriesOf("azione", productCountry, (k) => tr(k)).map((hit) => ({ type: "hit", key: hit.key, hit })) }];
      return filter ? [] : idle.filter((b) => b.items.length > 0);
    }
    const local = searchStatic(query, productCountry, (key) => tr(key));
    // While the answer for the latest text is on its way, the previous one stays only where it still matches what is typed
    // («mutuo» results must not lead under «comprato»).
    const stale = server.isPlaceholderData || query !== serverQuery;
    const remote = query.length >= SERVER_MIN_LENGTH
      ? (server.data?.hits ?? [])
          .filter((h) => !stale || matchScore(h.title, query) > 0 || (h.subtitle !== undefined && matchScore(h.subtitle, query) > 0))
          .map((h) => ({ ...h, subtitle: h.subtitle ? tr(h.subtitle) : undefined }))
      : [];
    const allowed = filter ? new Set(FILTER_GROUPS[filter]) : null;
    const hits = [...remote, ...local].filter((h) => !allowed || allowed.has(h.group));
    const result: SpotlightBlock[] = [];
    if (draft) result.push({ id: "comando", title: draft.source === "ai" ? "Capito dall'AI" : "Da aggiungere", items: [{ type: "command", key: "command", draft, instrument }] });
    const arranged = arrangeHits(hits).map<SpotlightBlock>((b) => ({ id: b.id, title: b.id === "top" ? "Risultato migliore" : SEARCH_GROUP_TITLES[b.id], items: b.hits.map((hit) => ({ type: "hit", key: hit.key, hit })) }));
    const aiBlock: SpotlightBlock = { id: "ai", title: null, items: [{ type: "ai", key: "ai", status: aiForText?.status ?? "idle" }] };
    // The AI row leads when nothing else matched, and closes the list otherwise.
    if (offerAi && arranged.length === 0) result.push(aiBlock);
    result.push(...arranged);
    if (offerAi && arranged.length > 0) result.push(aiBlock);
    return result;
  }, [query, serverQuery, filter, idle, productCountry, tr, server.data, server.isPlaceholderData, draft, instrument, offerAi, aiForText?.status]);

  const items = blocks.flatMap((b) => b.items);
  const waiting = query.length >= SERVER_MIN_LENGTH && (query !== serverQuery || server.isFetching);
  return { blocks, items, waiting, query, moreMovements: server.data?.moreMovements ?? 0, askAi: () => askAi.mutate(text.trim()) };
}
