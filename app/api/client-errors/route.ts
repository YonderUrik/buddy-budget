import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { clientErrorSchema } from "@/lib/client-errors";
import { consumeClientErrorQuota } from "@/lib/client-errors/quota";
import { recordClientError, requestLogger, withRoute } from "@/lib/observability";

/**
 * Riceve un errore del browser (pagina rotta durante il rendering) e lo scrive nei log a livello `error` e nella metrica
 * `buddybudget_client_errors_total`. Arriva solo l'area dell'app, mai il percorso; il messaggio passa dalla redazione del logger.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;

  const parsed = clientErrorSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { kind, area, name, message, digest } = parsed.data;
  const log = requestLogger();

  if (!(await consumeClientErrorQuota(session.user.id))) {
    recordClientError(kind, area, "rate_limited");
    return new Response(null, { status: 429 });
  }

  const error = new Error(message);
  if (name) error.name = name;
  recordClientError(kind, area, "reported");
  log.error("client.error.reported", { kind, clientArea: area, errorDigest: digest, error });
  return new Response(null, { status: 204 });
}

export const POST = withRoute("client_errors.report", handlePost);
