/** Errore generico di una fonte di prezzi: il messaggio non contiene mai chiavi o URL con parametri. */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** La fonte ha risposto "troppe richieste" (429 o equivalente). */
export class ProviderRateLimitedError extends ProviderError {
  constructor(provider: string, status?: number) {
    super(provider, "rate limited", status);
    this.name = "ProviderRateLimitedError";
  }
}

/** La fonte ci blocca (firewall, captcha, 403): inutile riprovare nella stessa esecuzione. */
export class ProviderBlockedError extends ProviderError {
  constructor(provider: string, status?: number) {
    super(provider, "blocked", status);
    this.name = "ProviderBlockedError";
  }
}

/** Converte una risposta HTTP non ok nell'errore tipizzato giusto. */
export function errorForStatus(provider: string, status: number): ProviderError {
  if (status === 429) return new ProviderRateLimitedError(provider, status);
  if (status === 401 || status === 403) return new ProviderBlockedError(provider, status);
  return new ProviderError(provider, `http ${status}`, status);
}
