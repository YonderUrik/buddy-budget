import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instrumentProfiles, type Instrument, type InstrumentType } from "@/lib/db/schema/investments";
import { logger, type Logger } from "@/lib/observability";
import { fetchYahooProfile, type YahooProfile, type YahooProfileKind } from "./providers/yahoo";
import { loadSymbols } from "./store";
import type { ProviderContext } from "./types";

/** Un profilo più vecchio di così si riscarica (settori e primi titoli cambiano lentamente). */
export const PROFILE_REFRESH_DAYS = 30;
/** Profili aggiornati al massimo in un giro del cron, per non consumare Yahoo. */
export const PROFILE_REFRESH_LIMIT = 20;
/** Profili scaricati al massimo quando la pagina trova strumenti senza profilo. */
export const PROFILE_ON_DEMAND_LIMIT = 5;
/** Tipi per cui Yahoo ha un profilo utile (le crypto e gli ETC si descrivono dal tipo). */
export const PROFILE_TYPES: readonly InstrumentType[] = ["etf", "fondo", "azione"];

/** Fonte dei profili: Yahoo in produzione, finta in sviluppo e nei test. */
export interface ProfileProvider {
  fetchProfile(symbol: string, kind: YahooProfileKind, ctx: ProviderContext): Promise<YahooProfile | null>;
}

export const yahooProfileProvider: ProfileProvider = { fetchProfile: fetchYahooProfile };

export function profileKind(type: InstrumentType): YahooProfileKind {
  return type === "azione" ? "company" : "fund";
}

/** Esito dell'aggiornamento di un profilo: enum chiuso, finisce nei log. */
export type ProfileOutcome = "saved" | "empty" | "no_symbol" | "failed";

/**
 * Scarica e salva il profilo di uno strumento. Una risposta vuota salva comunque la riga (così non si richiede
 * ogni giorno); senza simbolo Yahoo non si salva niente (il simbolo può arrivare più tardi). Non lancia mai.
 */
export async function refreshInstrumentProfile(
  instrument: Pick<Instrument, "id" | "type">,
  yahooSymbol: string | null,
  ctx: ProviderContext,
  options: { provider?: ProfileProvider; log?: Logger } = {}
): Promise<ProfileOutcome> {
  if (!yahooSymbol) return "no_symbol";
  const provider = options.provider ?? yahooProfileProvider;
  const log = options.log ?? logger;
  try {
    const profile = await provider.fetchProfile(yahooSymbol, profileKind(instrument.type), ctx);
    const values = {
      source: "yahoo" as const,
      symbol: yahooSymbol,
      sectors: profile?.sectors ?? null,
      assetMix: profile?.assetMix ?? null,
      holdings: profile?.holdings ?? null,
      sector: profile?.sector ?? null,
      country: profile?.country ?? null,
      fetchedAt: new Date(),
    };
    await db
      .insert(instrumentProfiles)
      .values({ instrumentId: instrument.id, ...values })
      .onConflictDoUpdate({ target: instrumentProfiles.instrumentId, set: values });
    const empty = !profile || (!profile.sectors && !profile.assetMix && !profile.holdings && !profile.sector && !profile.country);
    return empty ? "empty" : "saved";
  } catch (error) {
    log.warn("market.profiles.failed", { symbol: yahooSymbol, error });
    return "failed";
  }
}

/** Riepilogo di un giro di aggiornamento dei profili: solo conteggi. */
export interface ProfilesSummary {
  candidates: number;
  saved: number;
  empty: number;
  failed: number;
}

/**
 * Cron: aggiorna i profili degli strumenti dati (posseduti) mai scaricati o più vecchi di `PROFILE_REFRESH_DAYS`,
 * al massimo `PROFILE_REFRESH_LIMIT`, dai più vecchi. Non fa mai fallire il cron.
 */
export async function refreshStaleProfiles(
  held: Instrument[],
  today: Date,
  ctx: ProviderContext,
  options: { provider?: ProfileProvider; log?: Logger; limit?: number } = {}
): Promise<ProfilesSummary> {
  const summary: ProfilesSummary = { candidates: 0, saved: 0, empty: 0, failed: 0 };
  const log = options.log ?? logger;
  try {
    const eligible = held.filter((i) => PROFILE_TYPES.includes(i.type));
    if (eligible.length === 0) return summary;
    const staleBefore = new Date(today.getTime() - PROFILE_REFRESH_DAYS * 86_400_000);
    const ids = eligible.map((i) => i.id);
    const fresh = await db
      .select({ instrumentId: instrumentProfiles.instrumentId, fetchedAt: instrumentProfiles.fetchedAt })
      .from(instrumentProfiles)
      .where(inArray(instrumentProfiles.instrumentId, ids));
    const fetchedAt = new Map(fresh.map((r) => [r.instrumentId, r.fetchedAt]));
    const due = eligible
      .filter((i) => {
        const at = fetchedAt.get(i.id);
        return !at || at < staleBefore;
      })
      .sort((a, b) => (fetchedAt.get(a.id)?.getTime() ?? 0) - (fetchedAt.get(b.id)?.getTime() ?? 0))
      .slice(0, options.limit ?? PROFILE_REFRESH_LIMIT);
    summary.candidates = due.length;
    const symbols = await loadSymbols(due.map((i) => i.id));
    for (const instrument of due) {
      const outcome = await refreshInstrumentProfile(instrument, symbols.get(instrument.id)?.yahoo ?? null, ctx, options);
      if (outcome === "saved") summary.saved += 1;
      else if (outcome === "empty") summary.empty += 1;
      else if (outcome === "failed") summary.failed += 1;
    }
    log.info("market.profiles.updated", { total: summary.candidates, processed: summary.saved, count: summary.empty });
  } catch (error) {
    log.warn("market.profiles.failed", { error });
  }
  return summary;
}

/** Strumenti tra quelli dati che non hanno ancora un profilo salvato (per scaricarli su richiesta). */
export async function findInstrumentsWithoutProfile(instruments: Instrument[]): Promise<Instrument[]> {
  const eligible = instruments.filter((i) => i.priceMode === "auto" && PROFILE_TYPES.includes(i.type));
  if (eligible.length === 0) return [];
  const existing = await db
    .select({ instrumentId: instrumentProfiles.instrumentId })
    .from(instrumentProfiles)
    .where(inArray(instrumentProfiles.instrumentId, eligible.map((i) => i.id)));
  const have = new Set(existing.map((r) => r.instrumentId));
  return eligible.filter((i) => !have.has(i.id));
}

/** Profili salvati degli strumenti dati. */
export async function loadProfiles(instrumentIds: string[]) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: instrumentProfiles.instrumentId,
      symbol: instrumentProfiles.symbol,
      sectors: instrumentProfiles.sectors,
      assetMix: instrumentProfiles.assetMix,
      holdings: instrumentProfiles.holdings,
      sector: instrumentProfiles.sector,
      country: instrumentProfiles.country,
    })
    .from(instrumentProfiles)
    .where(inArray(instrumentProfiles.instrumentId, instrumentIds));
}

