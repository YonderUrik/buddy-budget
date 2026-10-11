/**
 * Stato puro del mazzo di carte della categorizzazione rapida: coda di esercenti, scelte non ancora salvate,
 * «salta» (la carta va in fondo) e «annulla». Le scelte restano in attesa fino al `takePending`, così si possono
 * annullare senza toccare il server; dopo il salvataggio non sono più annullabili da qui.
 */

export interface DeckDecision {
  groupKey: string;
  categoryId: string;
  /** L'utente ha chiesto esplicitamente di ricordare la scelta come regola. */
  remember: boolean;
  excludedPercentage: number;
  /** `conferma` = ha accettato la proposta; `cambia` = ha scelto un'altra categoria. */
  action: "conferma" | "cambia";
}

type HistoryEntry = { kind: "skip"; groupKey: string } | { kind: "decision"; groupKey: string; flushed: boolean };

export interface DeckState {
  /** Chiavi dei gruppi ancora da mostrare: la prima è la carta in cima. */
  queue: string[];
  pending: DeckDecision[];
  history: HistoryEntry[];
  /** Tutte le chiavi già incontrate, per non riproporre ciò che è stato deciso e non è ancora uscito dal server. */
  seen: string[];
}

export function initDeck(groupKeys: string[]): DeckState {
  return { queue: [...groupKeys], pending: [], history: [], seen: [...groupKeys] };
}

/**
 * Allinea il mazzo ai gruppi che il server restituisce: toglie le carte sparite e aggiunge in coda quelle nuove
 * (mai quelle già viste, né quelle con una scelta in attesa).
 */
export function reconcileDeck(state: DeckState, groupKeys: string[]): DeckState {
  const available = new Set(groupKeys);
  const seen = new Set(state.seen);
  const queue = state.queue.filter((key) => available.has(key));
  const fresh = groupKeys.filter((key) => !seen.has(key));
  const sameQueue = queue.length === state.queue.length && fresh.length === 0;
  if (sameQueue) return state;
  return { ...state, queue: [...queue, ...fresh], seen: [...state.seen, ...fresh] };
}

/** Registra la scelta sulla carta in cima e passa alla successiva. */
export function decide(state: DeckState, decision: Omit<DeckDecision, "groupKey">): DeckState {
  const [top, ...rest] = state.queue;
  if (top === undefined) return state;
  return {
    ...state,
    queue: rest,
    pending: [...state.pending, { ...decision, groupKey: top }],
    history: [...state.history, { kind: "decision", groupKey: top, flushed: false }],
  };
}

/** La carta in cima va in fondo al mazzo; con una sola carta non succede nulla. */
export function skip(state: DeckState): DeckState {
  if (state.queue.length < 2) return state;
  const [top, ...rest] = state.queue;
  return { ...state, queue: [...rest, top], history: [...state.history, { kind: "skip", groupKey: top }] };
}

/** Si può annullare l'ultima azione (un «salta» o una scelta non ancora salvata). */
export function canUndo(state: DeckState): boolean {
  const last = state.history.at(-1);
  return last !== undefined && !(last.kind === "decision" && last.flushed);
}

/** Annulla l'ultima azione riportando la carta in cima; le scelte già salvate non si annullano. */
export function undo(state: DeckState): DeckState {
  const last = state.history.at(-1);
  if (!last || (last.kind === "decision" && last.flushed)) return state;
  const history = state.history.slice(0, -1);
  if (last.kind === "skip") {
    const index = state.queue.lastIndexOf(last.groupKey);
    if (index === -1) return { ...state, history };
    const queue = state.queue.filter((_, i) => i !== index);
    return { ...state, queue: [last.groupKey, ...queue], history };
  }
  return {
    ...state,
    queue: [last.groupKey, ...state.queue],
    pending: state.pending.filter((decision) => decision.groupKey !== last.groupKey),
    history,
  };
}

/** Consegna le scelte in attesa da salvare e le segna come non più annullabili. */
export function takePending(state: DeckState): { state: DeckState; decisions: DeckDecision[] } {
  if (state.pending.length === 0) return { state, decisions: [] };
  return {
    decisions: state.pending,
    state: {
      ...state,
      pending: [],
      history: state.history.map((entry) => (entry.kind === "decision" ? { ...entry, flushed: true } : entry)),
    },
  };
}

/** Rimette in cima le carte la cui scelta non è stata salvata (errore di rete): tornano da rifare. */
export function requeue(state: DeckState, groupKeys: string[]): DeckState {
  const back = groupKeys.filter((key) => !state.queue.includes(key));
  return { ...state, queue: [...back, ...state.queue] };
}
