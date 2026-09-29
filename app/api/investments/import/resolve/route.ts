import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveIdentity } from "@/lib/investments/import/resolve";
import type { ImportMatch } from "@/lib/investments/import/types";
import { searchCryptoOnProviders, searchInstrumentsOnProviders } from "@/lib/market-data/runtime";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { resolveImportSchema } from "@/lib/validation/investments-import";

// Una ricerca sulle fonti per strumento nuovo, una alla volta (Yahoo va in raffreddamento se lo si martella).
export const maxDuration = 120;

/**
 * Abbina gli strumenti trovati in un file da importare: già nel catalogo, proposti dalle fonti (da creare all'import)
 * o da scegliere a mano. Non scrive nulla.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = resolveImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const deps = { searchMarket: searchInstrumentsOnProviders, searchCrypto: searchCryptoOnProviders };
  const results: { key: string; match: ImportMatch }[] = [];
  for (const identity of parsed.data.identities) {
    results.push({ key: identity.key, match: await resolveIdentity(session.user.id, identity, deps) });
  }
  return Response.json({ results });
}

export const POST = withRoute("investment_import.resolve", handlePost);
