import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDueSyncs } from "@/lib/gocardless/scheduler";
import { withRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";
// I conti dovuti si sincronizzano dentro la richiesta: nessun utente aspetta la risposta, quindi
// niente job/after() (lo standard "Operazioni lunghe" riguarda le operazioni avviate dall'utente).
export const maxDuration = 300;

/** Cron di sync GoCardless dei conti dovuti (Vercel Cron oggi, CronJob k8s dopo la migrazione). Idempotente. */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    await runDueSyncs();
  } catch (error) {
    console.error("Cron sync GoCardless fallito", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, durationMs: Date.now() - startedAt });
}

export const GET = withRoute("cron.gocardless_sync", handleGet);
