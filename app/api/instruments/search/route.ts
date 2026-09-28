import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { searchKnownInstruments } from "@/lib/investments/instruments";
import { searchCryptoOnProviders, searchInstrumentsOnProviders } from "@/lib/market-data/runtime";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { isValidIsin } from "@/lib/validation/investments";

/** Lunghezza minima della ricerca: sotto, troppi risultati inutili e chiamate sprecate alle fonti. */
const MIN_QUERY_LENGTH = 2;

/**
 * Cerca strumenti per nome, ticker o ISIN: prima tra quelli già noti, poi su Yahoo e CoinGecko. Le fonti che non
 * rispondono si ignorano (la ricerca resta utile con quello che c'è) e si segnalano con `marketUnavailable`/`cryptoUnavailable`. `isin` è valorizzato se la query è un ISIN
 * valido, per offrire la creazione "solo ISIN" (BTP) o manuale.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ known: [], market: [], crypto: [], isin: null, marketUnavailable: false, cryptoUnavailable: false });
  }

  const log = requestLogger();
  const [known, market, crypto] = await Promise.all([
    searchKnownInstruments(session.user.id, query),
    searchInstrumentsOnProviders(query).catch((error) => {
      log.warn("instruments.search.provider_failed", { provider: "yahoo", error });
      return null;
    }),
    searchCryptoOnProviders(query).catch((error) => {
      log.warn("instruments.search.provider_failed", { provider: "coingecko", error });
      return null;
    }),
  ]);
  const upper = query.toUpperCase();
  return Response.json({
    known,
    market: market ?? [],
    crypto: (crypto ?? []).slice(0, 5),
    isin: isValidIsin(upper) ? upper : null,
    // Una fonte che non ha risposto non è "nessun risultato": la UI lo dice, invece di un elenco vuoto muto.
    marketUnavailable: market === null,
    cryptoUnavailable: crypto === null,
  });
}

export const GET = withRoute("instruments.search", handleGet);
