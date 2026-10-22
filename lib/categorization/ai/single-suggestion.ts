/** Answer to «Chiedi all'AI» on one transaction, as `POST /api/transactions/[id]/ai-suggestion` returns it. */
export type SingleSuggestion =
  | { status: "ok"; categoryId: string; confidence: number }
  /** The user has not turned the assistant on. */
  | { status: "disabled" }
  /** No OpenRouter key on this server. */
  | { status: "no_key" }
  /** Too many questions in the window. */
  | { status: "limited" }
  /** The model failed or gave no usable answer. */
  | { status: "failed" };

export type SingleSuggestionStatus = SingleSuggestion["status"];
