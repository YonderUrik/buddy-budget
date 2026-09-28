import type { InstrumentType } from "@/lib/db/schema/investments";
import { ProviderBlockedError, ProviderError } from "../errors";
import { providerGet, readJson, setCookieHeader } from "../http";
import type { DailyClose, PriceProvider, ProviderContext } from "../types";

/**
 * Borsa Italiana: endpoint JSON non documentato dei grafici del sito, lo stesso usato dalla libreria LGPL
 * `Librefolio/borsaItaliana-scraping`. Flusso: la pagina `interactive-chart` contiene un JWT anonimo
 * (`token="..."`) e imposta i cookie del firewall Imperva; le API vogliono `Authorization: Bearer <jwt>` e quei
 * cookie. Fragile e in zona grigia sui termini d'uso: solo uso personale, in fondo o in testa alle catene a
 * seconda dell'esito della prova di copertura.
 */
const CHART_PAGE_URL = "https://grafici.borsaitaliana.it/interactive-chart/";
const API_URL = "https://grafici.borsaitaliana.it/api/instruments/";
const TOKEN_PATTERN = /token="([^"]+)"/;
/** Il token si riusa per un po' dentro lo stesso processo. */
export const BORSAITALIANA_TOKEN_TTL_MS = 20 * 60 * 1000;

/** Codice del mercato di Borsa Italiana per tipo di strumento: il simbolo è `ISIN,CODICE`. */
export const BORSAITALIANA_EXCHANGE_BY_TYPE: Partial<Record<InstrumentType, string>> = {
  obbligazione: "MOTX",
  etf: "ETFP",
  etc: "ETFP",
  azione: "XMIL",
};

interface Session {
  token: string;
  cookie: string;
  expiresAt: number;
}

let cachedSession: Session | null = null;

/** Svuota la sessione in cache (test, o dopo un 401). */
export function resetBorsaItalianaSession(): void {
  cachedSession = null;
}

async function getSession(symbol: string, ctx: ProviderContext, nowMs: number): Promise<Session> {
  if (cachedSession && cachedSession.expiresAt > nowMs) return cachedSession;
  const [isin, exchange] = symbol.split(",");
  const response = await providerGet("borsaitaliana", `${CHART_PAGE_URL}${isin}-${exchange}?lang=it`, ctx, {
    headers: { "Accept-Language": "it-IT,it;q=0.9" },
  });
  const html = await response!.text();
  const token = TOKEN_PATTERN.exec(html)?.[1];
  // Senza token la pagina è la sfida del firewall, non il grafico.
  if (!token) throw new ProviderBlockedError("borsaitaliana");
  cachedSession = { token, cookie: setCookieHeader(response!), expiresAt: nowMs + BORSAITALIANA_TOKEN_TTL_MS };
  return cachedSession;
}

/** Periodo più corto tra quelli accettati dall'API che copre l'intervallo richiesto. */
export function borsaItalianaPeriod(from: string, nowMs: number): string {
  const days = (nowMs - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days <= 28) return "1M";
  if (days <= 88) return "3M";
  if (days <= 180) return "6M";
  if (days <= 360) return "1Y";
  if (days <= 3 * 365) return "3Y";
  if (days <= 5 * 365) return "5Y";
  return "MAX";
}

interface HistoryResponse {
  history?: { currency?: string; historyDt?: { dt?: number | string; closePx?: number | string | null }[] | null } | null;
}

/** Converte la storia di Borsa Italiana: `dt` è YYYYMMDD (numero o stringa), `closePx` la chiusura. */
export function parseBorsaItalianaHistory(body: HistoryResponse): DailyClose[] {
  const history = body.history;
  if (!history?.historyDt) return [];
  const currency = history.currency?.toUpperCase() ?? null;
  const closes: DailyClose[] = [];
  for (const point of history.historyDt) {
    const dt = String(point.dt ?? "");
    if (!/^\d{8}$/.test(dt) || point.closePx === null || point.closePx === undefined) continue;
    closes.push({ date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, close: Number(point.closePx), currency });
  }
  return closes;
}

/** Fonte Borsa Italiana (simbolo `ISIN,CODICE_MERCATO`, es. `IT0005534984,MOTX`). */
export const borsaItalianaProvider: PriceProvider = {
  id: "borsaitaliana",
  requiredKeyEnv: null,
  maxHistory: "unlimited",
  minDelayMs: 1_500,
  async fetchDailyCloses(symbol, from, to, ctx) {
    const [isin, exchange] = symbol.split(",");
    if (!isin || !exchange) throw new ProviderError("borsaitaliana", "invalid symbol");
    const nowMs = Date.now();
    const session = await getSession(symbol, ctx, nowMs);
    const url = `${API_URL}${encodeURIComponent(`${isin},${exchange},ISIN`)}/history/period?period=${borsaItalianaPeriod(from, nowMs)}&add-last-price=true`;
    let response: Response | null;
    try {
      response = await providerGet("borsaitaliana", url, ctx, {
        notFoundAsNull: true,
        headers: { Authorization: `Bearer ${session.token}`, Cookie: session.cookie, "Accept-Language": "it-IT,it;q=0.9" },
      });
    } catch (error) {
      // Token scaduto o rifiutato: la prossima chiamata ne prende uno nuovo.
      if (error instanceof ProviderBlockedError) resetBorsaItalianaSession();
      throw error;
    }
    if (!response) return [];
    return parseBorsaItalianaHistory(await readJson<HistoryResponse>("borsaitaliana", response)).filter(
      (c) => c.date >= from && c.date <= to
    );
  },
};
