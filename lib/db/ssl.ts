/**
 * Opzione `ssl` per postgres.js. Fail-safe: in produzione TLS è obbligatorio a meno che l'URL non
 * specifichi `sslmode` in modo esplicito (es. `sslmode=disable` per un Postgres di prova senza certificati).
 * Con `sslmode` nell'URL si restituisce undefined, così decide l'URL (un `ssl` esplicito vincerebbe su di esso).
 */
export function resolveDbSsl(connectionString: string, nodeEnv: string | undefined): "require" | undefined {
  const hasExplicitSslMode = new URL(connectionString).searchParams.has("sslmode");
  if (hasExplicitSslMode) return undefined;
  return nodeEnv === "production" ? "require" : undefined;
}
