/**
 * lib/notifications — barrel file (parte condivisa con il client)
 *
 * Costanti e tipi delle email non di servizio (riepilogo periodico, avvisi su budget e scadenze). La parte che
 * parla col DB e con Resend sta in `./server`, da importare solo dal server.
 */

export * from "./constants";
