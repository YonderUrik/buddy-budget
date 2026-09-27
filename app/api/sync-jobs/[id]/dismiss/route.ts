import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Chiude il riepilogo di un job: resta nascosto anche su altri dispositivi. Solo job dell'utente in sessione. */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  try {
    const dismissed = await redisSyncJobStore.dismissJob(session.user.id, id);
    return dismissed ? new Response(null, { status: 204 }) : new Response(null, { status: 404 });
  } catch (error) {
    console.error("Chiusura del job di sync fallita", error);
    return new Response(null, { status: 503 });
  }
}

export const POST = withRoute("sync_jobs.dismiss", handlePost);
