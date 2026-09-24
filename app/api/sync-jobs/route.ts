import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { toJobView } from "@/lib/sync-jobs/view";

/** Job di sync dell'utente in sessione non ancora chiusi, già pronti per la UI (heartbeat valutato). */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  try {
    const jobs = await redisSyncJobStore.listJobs(session.user.id);
    const now = new Date();
    return Response.json(jobs.filter((job) => !job.dismissed).map((job) => toJobView(job, now)));
  } catch (error) {
    console.error("Lettura dei job di sync fallita", error);
    return Response.json({ error: "Stato della sincronizzazione non disponibile" }, { status: 503 });
  }
}
