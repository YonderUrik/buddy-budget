import { Agent, fetch as undiciFetch } from "undici";

/**
 * Cipher suite nell'ordine proposto da Chrome. Yahoo (e altri WAF) riconosce l'handshake TLS di Node dall'ordine
 * dei cipher di OpenSSL e risponde 429 a ogni richiesta, anche con User-Agent da browser e sessione valida:
 * verificato il 2026-09-28, stesso IP, Node di default 429, curl/Schannel 200, Node con questi cipher 200.
 */
const BROWSER_TLS_CIPHERS = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
  "ECDHE-ECDSA-CHACHA20-POLY1305",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES128-SHA",
  "ECDHE-RSA-AES256-SHA",
  "AES128-GCM-SHA256",
  "AES256-GCM-SHA384",
  "AES128-SHA",
  "AES256-SHA",
].join(":");

const browserTlsAgent = new Agent({ connect: { ciphers: BROWSER_TLS_CIPHERS } });

/**
 * `fetch` per le fonti di mercato, con handshake TLS da browser. Usa il `fetch` di undici (non quello globale,
 * che Next.js sostituisce) per poter passare il dispatcher.
 */
export const browserTlsFetch = ((input: string | URL | Request, init?: RequestInit) =>
  undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Parameters<typeof undiciFetch>[1]),
    dispatcher: browserTlsAgent,
  })) as unknown as typeof fetch;
