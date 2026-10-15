import { track } from "@/lib/analytics";

/** Start durable AI analysis only after the upload flow has collected explicit raw-file consent. */
export async function enqueueBrokerFallback(csv: string, name = "CSV da riconoscere"): Promise<string> {
  const response = await fetch("/api/personal-imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, name, brokerFallback: true, consent: true, consentVersion: "openrouter-raw-zdr-v3" }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Impossibile avviare l'analisi AI. Riprova il caricamento.");
  track("investments_import_ai_fallback", {});
  return body.id;
}
