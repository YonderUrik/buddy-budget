/**
 * Errori del browser (pagine che si rompono durante il rendering): tipi e aree ammessi. Enum chiusi perché finiscono
 * nelle etichette della metrica `buddybudget_client_errors_total`. Nessuna dipendenza, usabile dal client e dal server.
 */

import { z } from "zod";

/** `sezione` = error boundary di una schermata dell'app, `globale` = errore nel layout radice (global-error). */
export const CLIENT_ERROR_KINDS = ["sezione", "globale"] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];

/** Primo segmento dell'indirizzo, così si sa dove si è rotta la pagina senza mandare il percorso (che può contenere id). */
export const CLIENT_ERROR_AREAS = [
  "panoramica",
  "liquidita",
  "conti",
  "investimenti",
  "debiti",
  "pensione",
  "analitiche",
  "categorizza",
  "importazioni",
  "impostazioni",
  "aiuto",
  "onboarding",
  "altro",
] as const;
export type ClientErrorArea = (typeof CLIENT_ERROR_AREAS)[number];

/** Lunghezze massime accettate: il messaggio viene comunque redatto e accorciato dal logger. */
export const CLIENT_ERROR_MESSAGE_MAX = 500;
export const CLIENT_ERROR_NAME_MAX = 80;
export const CLIENT_ERROR_DIGEST_MAX = 64;

/** Area di un percorso (`/investimenti/titoli/abc` → `investimenti`); qualsiasi altro percorso è `altro`. */
export function clientErrorArea(pathname: string): ClientErrorArea {
  const first = pathname.split("/").find((segment) => segment.length > 0) ?? "";
  return (CLIENT_ERROR_AREAS as readonly string[]).includes(first) ? (first as ClientErrorArea) : "altro";
}

/** Corpo di `POST /api/client-errors`. */
export const clientErrorSchema = z.object({
  kind: z.enum(CLIENT_ERROR_KINDS),
  area: z.enum(CLIENT_ERROR_AREAS),
  name: z.string().max(CLIENT_ERROR_NAME_MAX).optional(),
  message: z.string().max(CLIENT_ERROR_MESSAGE_MAX),
  digest: z.string().max(CLIENT_ERROR_DIGEST_MAX).optional(),
});
export type ClientErrorReport = z.infer<typeof clientErrorSchema>;
