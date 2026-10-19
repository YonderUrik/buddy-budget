/** Error of a personal import call: the server's message, plus its `code` when it has one (`already_imported`). */
export class PersonalImportApiError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

/** Chiamata JSON verso `/api/personal-imports`: senza corpo è una GET, con corpo una POST. Lancia con il messaggio del server. */
export async function personalImportApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/personal-imports${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new PersonalImportApiError(data.error ?? "Operazione non riuscita. Riprova.", data.code);
  return data;
}
