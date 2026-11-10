/** The provider refused the input (context window, JSON/ZDR support) or the job may not call the model: final. */
export class ModelInputError extends Error {}
/** The model's answer cannot be used (cut at the token budget, not JSON, not a parser): the next attempt may do better. */
export class ModelOutputError extends Error {
  constructor(message: string, readonly truncated = false) { super(message); }
}
/** Provider, network or sandbox unavailable: the same attempt is retried later, never counted as a wrong parser. */
export class TransientError extends Error {}
