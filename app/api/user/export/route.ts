import { NextRequest } from "next/server";
import { buildUserExportZip, exportFileName } from "@/lib/account/export";
import { recentLoginRequired, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scarica uno ZIP con tutti i dati dell'utente (JSON completo + CSV). Richiede un accesso recente: sono tutti i
 * dati finanziari in un file. Sincrono (deroga allo standard "Operazioni lunghe"): sono sole letture del DB.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const denied = recentLoginRequired(session);
  if (denied) return denied;

  const now = new Date();
  const zip = await buildUserExportZip(session.user.id, now);
  requestLogger().info("account.export.completed", { count: zip.byteLength });
  return new Response(zip as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withRoute("user.export", handleGet);
