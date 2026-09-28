/**
 * Prova di copertura delle fonti prezzi (Task 1 del piano investimenti, Fase 0 della spec).
 *
 * Per un campione di strumenti pubblici chiede a OGNI fonte (non alla catena) le chiusure degli ultimi 30 giorni
 * e stampa una tabella fonte × strumento: esito, numero di chiusure, ultima chiusura, valuta, tempo. Con `--save`
 * salva le risposte grezze come fixture `real-*` in `lib/market-data/providers/__fixtures__/`.
 *
 * Uso in locale:
 *   pnpm exec tsx scripts/probe-price-sources.ts [--save] [--btp=ISIN] [--fund=ISIN] [--fund-yahoo=SIMBOLO]
 * Le chiavi facoltative (STOOQ_API_KEY, ALPHAVANTAGE_API_KEY, TWELVEDATA_API_KEY, COINGECKO_API_KEY) si leggono
 * dall'ambiente: senza chiave la fonte risulta "skipped".
 *
 * Uso dalla VPS (IP del datacenter, dove i blocchi sono più probabili): Job usa-e-getta con l'immagine migrator,
 * che contiene tsx e questo script.
 *
 *   kubectl -n app create job probe-prezzi --image=ghcr.io/yonderurik/buddy-budget-migrate:<tag> \
 *     -- pnpm exec tsx scripts/probe-price-sources.ts --btp=<ISIN> --fund=<ISIN>
 *   kubectl -n app logs -f job/probe-prezzi
 *   kubectl -n app delete job probe-prezzi
 *
 * Il namespace `app` non limita il traffico in uscita, quindi il Job raggiunge le fonti come l'app vera.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InstrumentType } from "@/lib/db/schema/investments";
import { PRICE_PROVIDERS, FX_PROVIDERS, searchYahoo, searchCoinGecko } from "@/lib/market-data/providers";
import { deriveSymbols } from "@/lib/market-data/symbols";
import type { ProviderContext, ProviderId } from "@/lib/market-data/types";

interface Sample {
  label: string;
  isin: string | null;
  type: InstrumentType;
  currency: string;
  /** Simbolo Yahoo da usare se la ricerca per ISIN non ne trova (o per forzare una borsa). */
  yahooSymbol?: string;
  coingeckoQuery?: string;
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

const SAMPLES: Sample[] = [
  { label: "VWCE Xetra", isin: "IE00BK5BQT80", type: "etf", currency: "EUR", yahooSymbol: "VWCE.DE" },
  { label: "VWCE Milano", isin: "IE00BK5BQT80", type: "etf", currency: "EUR", yahooSymbol: "VWCE.MI" },
  { label: "SWDA Milano", isin: "IE00B4L5Y983", type: "etf", currency: "EUR", yahooSymbol: "SWDA.MI" },
  { label: "ENEL", isin: "IT0003128367", type: "azione", currency: "EUR", yahooSymbol: "ENEL.MI" },
  { label: "Apple", isin: "US0378331005", type: "azione", currency: "USD", yahooSymbol: "AAPL" },
  { label: "Bitcoin", isin: null, type: "crypto", currency: "EUR", coingeckoQuery: "bitcoin" },
];
const btp = arg("btp");
if (btp) SAMPLES.push({ label: "BTP", isin: btp, type: "obbligazione", currency: "EUR" });
const fund = arg("fund");
if (fund) SAMPLES.push({ label: "Fondo", isin: fund, type: "fondo", currency: "EUR", yahooSymbol: arg("fund-yahoo") });

const SAVE = process.argv.includes("--save");
const FIXTURE_DIR = join(process.cwd(), "lib/market-data/providers/__fixtures__");

/** Toglie chiavi e identificativi dalle risposte salvate (Alpha Vantage ripete la chiave nei messaggi). */
function redact(body: string): string {
  return body.replace(/API key as \S+/g, "API key as REDACTED").replace(/apikey=[^&"\s]+/gi, "apikey=REDACTED");
}

function recordingContext(bodies: string[]): ProviderContext {
  return {
    env: process.env,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const response = await fetch(input, init);
      const text = await response.clone().text();
      bodies.push(text);
      return response;
    }) as typeof fetch,
  };
}

function dateKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const from = dateKey(30);
  const to = dateKey(0);
  const rows: Record<string, string>[] = [];
  if (SAVE) mkdirSync(FIXTURE_DIR, { recursive: true });

  for (const sample of SAMPLES) {
    let yahooSymbol = sample.yahooSymbol ?? null;
    let coingeckoId: string | null = null;
    const searchBodies: string[] = [];
    try {
      if (sample.type === "crypto" && sample.coingeckoQuery) {
        coingeckoId = (await searchCoinGecko(sample.coingeckoQuery, recordingContext(searchBodies)))[0]?.id ?? null;
      } else if (sample.isin) {
        const hits = await searchYahoo(sample.isin, recordingContext(searchBodies));
        console.log(`ricerca Yahoo ${sample.isin}: ${hits.map((h) => `${h.symbol} (${h.exchangeLabel})`).join(", ") || "nessun risultato"}`);
        yahooSymbol ??= hits[0]?.symbol ?? null;
        if (SAVE && searchBodies[0]) writeFileSync(join(FIXTURE_DIR, `real-yahoo-search-${sample.isin}.json`), redact(searchBodies[0]));
      }
    } catch (error) {
      console.log(`ricerca fallita per ${sample.label}: ${(error as Error).message}`);
    }

    const symbols = deriveSymbols({ isin: sample.isin, type: sample.type, currency: sample.currency, yahooSymbol, coingeckoId });
    for (const [providerId, provider] of Object.entries(PRICE_PROVIDERS) as [ProviderId, (typeof PRICE_PROVIDERS)[ProviderId]][]) {
      const symbol = symbols[providerId];
      const row: Record<string, string> = { strumento: sample.label, fonte: providerId, simbolo: symbol ?? "-" };
      if (!symbol) {
        rows.push({ ...row, esito: "nessun simbolo" });
        continue;
      }
      if (provider.requiredKeyEnv && !process.env[provider.requiredKeyEnv]) {
        rows.push({ ...row, esito: `skipped (manca ${provider.requiredKeyEnv})` });
        continue;
      }
      const bodies: string[] = [];
      const started = Date.now();
      try {
        const closes = await provider.fetchDailyCloses(symbol, from, to, recordingContext(bodies));
        const last = closes.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
        rows.push({
          ...row,
          esito: closes.length > 0 ? "ok" : "vuoto",
          chiusure: String(closes.length),
          ultima: last ? `${last.date} ${last.close}` : "-",
          valuta: last?.currency ?? "(non dichiarata)",
          ms: String(Date.now() - started),
        });
      } catch (error) {
        rows.push({ ...row, esito: `${(error as Error).name}: ${(error as Error).message}`, ms: String(Date.now() - started) });
      }
      if (SAVE && bodies.length > 0) {
        const safeLabel = sample.label.replace(/\W+/g, "-").toLowerCase();
        writeFileSync(join(FIXTURE_DIR, `real-${providerId}-${safeLabel}.txt`), redact(bodies.at(-1)!));
      }
      await new Promise((resolve) => setTimeout(resolve, provider.minDelayMs));
    }
  }

  for (const fxProvider of FX_PROVIDERS) {
    const started = Date.now();
    try {
      const rates = await fxProvider.fetchRates(["USD", "GBP", "CHF"], from, to, { fetch, env: process.env });
      rows.push({ strumento: "cambi", fonte: fxProvider.id, esito: rates.length > 0 ? "ok" : "vuoto", chiusure: String(rates.length), ms: String(Date.now() - started) });
    } catch (error) {
      rows.push({ strumento: "cambi", fonte: fxProvider.id, esito: `${(error as Error).name}: ${(error as Error).message}` });
    }
  }

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
