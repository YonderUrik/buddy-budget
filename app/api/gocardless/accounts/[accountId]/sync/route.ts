import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { syncAccountLink } from "@/lib/gocardless/sync";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";

/**
 * Avvia un sync manuale immediato per un singolo conto collegato dell'utente autenticato.
 * Ownership check (accountId + userId + connessione "linked") prima di qualunque altra
 * operazione, poi controllo eleggibilità (budget condiviso 4/giorno + gap 4h) PRIMA di
 * chiamare syncAccountLink, per non consumare una chiamata reale a GoCardless se il
 * budget è già esaurito. Mappa SyncResult su HTTP: synced 200, gocardless-limited 429,
 * expired 409; not-eligible (pre-check locale) è anch'esso 429.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { accountId } = await params;

  const [link] = await db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
      userId: bankConnections.userId,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankAccountLinks.accountId, accountId),
        eq(bankConnections.userId, session.user.id),
        eq(bankConnections.status, "linked")
      )
    );

  if (!link) return Response.json({ error: "Conto non trovato o non collegato" }, { status: 404 });

  const eligibility = computeSyncEligibility(
    link.syncTimestamps.map((t) => new Date(t)),
    new Date()
  );
  if (!eligibility.eligible) {
    return Response.json(
      {
        status: "not-eligible",
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      },
      { status: 429 }
    );
  }

  const result = await syncAccountLink(link, redisRateLimitStore);

  if (result.status === "gocardless-limited") {
    return Response.json({ status: "gocardless-limited" }, { status: 429 });
  }
  if (result.status === "expired") {
    return Response.json({ status: "expired" }, { status: 409 });
  }
  return Response.json(result, { status: 200 });
}
