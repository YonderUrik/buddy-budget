import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import { recordHttpRequest } from "./metrics";
import { currentRequestFields, runWithRequestContext } from "./request-context";

/** Header con cui l'id della richiesta viene accettato dal chiamante e restituito in risposta. */
export const REQUEST_ID_HEADER = "x-request-id";

const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export interface WithRouteOptions {
  /** Non logga le risposte riuscite (<400): per probe e scrape chiamati ogni pochi secondi. */
  quietOnSuccess?: boolean;
}

/** Id della richiesta: quello del chiamante se ben formato, altrimenti uno nuovo. */
export function resolveRequestId(headerValue: string | null): string {
  return headerValue && VALID_REQUEST_ID.test(headerValue) ? headerValue : randomUUID();
}

function withRequestIdHeader(response: Response, requestId: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    // Header immutabili (es. Response.redirect): si ricostruisce la risposta con stesso status e body.
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

/**
 * Avvolge un Route Handler: requestId (accettato o generato e restituito in `x-request-id`), durata,
 * log `http.request.completed|failed`, metriche HTTP, e 500 generico sulle eccezioni non gestite.
 * `name` è un nome STATICO (es. "transactions.update"), mai il path reale: finisce nelle etichette
 * delle metriche. Dentro l'handler il logger della richiesta si ottiene con `requestLogger()`.
 */
export function withRoute<R extends Request, A extends unknown[]>(
  name: string,
  handler: (request: R, ...rest: A) => Promise<Response> | Response,
  options: WithRouteOptions = {}
): (request: R, ...rest: A) => Promise<Response> {
  return (request, ...rest) => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    const method = request.method;
    return runWithRequestContext({ requestId, route: name, method }, async () => {
      const startedAt = performance.now();
      let response: Response;
      let failure: unknown;
      try {
        response = await handler(request, ...rest);
      } catch (error) {
        failure = error;
        response = Response.json({ error: "Errore interno" }, { status: 500 });
      }
      const durationMs = Math.round(performance.now() - startedAt);
      const status = response.status;
      const log = logger.child(currentRequestFields());
      if (failure !== undefined) {
        log.error("http.request.failed", { status, durationMs, error: failure });
      } else if (status >= 500) {
        log.error("http.request.completed", { status, durationMs });
      } else if (status === 429) {
        log.warn("http.request.completed", { status, durationMs });
      } else if (!(options.quietOnSuccess && status < 400)) {
        log.info("http.request.completed", { status, durationMs });
      }
      try {
        recordHttpRequest(name, method, status, durationMs);
      } catch (error) {
        log.warn("metrics.record.failed", { error });
      }
      return withRequestIdHeader(response, requestId);
    });
  };
}
