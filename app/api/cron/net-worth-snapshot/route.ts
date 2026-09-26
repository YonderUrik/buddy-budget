import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDailySnapshots } from "@/lib/net-worth/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron giornaliero degli snapshot patrimonio di tutti gli utenti con conti. Idempotente (upsert per giorno). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    await runDailySnapshots();
  } catch (error) {
    console.error("Cron snapshot patrimonio fallito", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, durationMs: Date.now() - startedAt });
}
