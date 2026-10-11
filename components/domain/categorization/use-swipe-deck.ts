"use client";

/** Stato e salvataggio del mazzo di categorizzazione rapida: le scelte si accumulano e si salvano insieme dopo una pausa o uscendo. */

import * as React from "react";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import {
  canUndo,
  decide,
  initDeck,
  reconcileDeck,
  requeue,
  skip,
  takePending,
  undo,
  type DeckDecision,
  type DeckState,
} from "@/lib/categorization/swipe-deck";

/** Pausa senza nuove scelte dopo la quale quelle in attesa vengono salvate (e smettono di essere annullabili). */
export const SWIPE_SAVE_DELAY_MS = 5000;

export interface UseSwipeDeckOptions {
  groups: SuggestionGroup[];
  /** Salva le scelte; deve rifiutare in caso di errore, così le carte tornano nel mazzo. */
  onSave: (decisions: DeckDecision[]) => Promise<void>;
}

export function useSwipeDeck({ groups, onSave }: UseSwipeDeckOptions) {
  const keys = React.useMemo(() => groups.map((group) => group.groupKey), [groups]);
  const [state, setState] = React.useState<DeckState>(() => initDeck(keys));
  const stateRef = React.useRef(state);
  const onSaveRef = React.useRef(onSave);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    stateRef.current = state;
    onSaveRef.current = onSave;
  });

  // Quando il server cambia l'elenco il mazzo si riallinea durante il render (niente effetto con setState).
  const [seenKeys, setSeenKeys] = React.useState(keys);
  if (seenKeys !== keys) {
    setSeenKeys(keys);
    setState((current) => reconcileDeck(current, keys));
  }

  const flush = React.useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const { state: next, decisions } = takePending(stateRef.current);
    if (decisions.length === 0) return;
    stateRef.current = next;
    setState(next);
    try {
      await onSaveRef.current(decisions);
    } catch {
      setState((current) => requeue(current, decisions.map((decision) => decision.groupKey)));
    }
  }, []);

  const schedule = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SWIPE_SAVE_DELAY_MS);
  }, [flush]);

  // Uscendo dalla pagina o nascondendo la scheda le scelte in attesa vengono salvate.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  const groupByKey = React.useMemo(() => new Map(groups.map((group) => [group.groupKey, group])), [groups]);
  const top = state.queue[0] ? groupByKey.get(state.queue[0]) : undefined;

  return {
    top,
    next: state.queue[1] ? groupByKey.get(state.queue[1]) : undefined,
    remaining: state.queue.length,
    pendingCount: state.pending.length,
    canUndo: canUndo(state),
    decide: (decision: Omit<DeckDecision, "groupKey">) => {
      setState((current) => decide(current, decision));
      schedule();
    },
    skip: () => setState((current) => skip(current)),
    undo: () => setState((current) => undo(current)),
    flush,
  };
}
