/** Hook di boot Next.js: valida le variabili d'ambiente all'avvio del server (fallisce subito se ne manca una). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("@/lib/env");
    parseServerEnv(process.env);
  }
}
