import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { enqueue, listImports } from "@/lib/personal-import/jobs";
import { ImportError, MAX_BYTES } from "@/lib/personal-import/contract";
const inputSchema = z.object({ csv: z.string().min(1).max(MAX_BYTES), name: z.string().trim().min(1).max(80), formatId: z.uuid().optional(), regenerate: z.boolean().optional(), consent: z.literal(true) });
export const GET = withRoute("personal_import.list", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await listImports(session.user.id), { headers: { "Cache-Control": "no-store" } });
});
export const POST = withRoute("personal_import.enqueue", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (request.headers.get("origin") !== new URL(process.env.APP_URL ?? request.url).origin) return new Response(null, { status: 403 });
  if (!process.env.PERSONAL_CSV_ENCRYPTION_KEY) return Response.json({ error: "Importazione personalizzata non ancora configurata" }, { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES * 2 + 65536) { await reader.cancel(); return Response.json({ error: "File troppo grande" }, { status: 413 }); } chunks.push(value); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return Response.json({ error: "Richiesta non valida" }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Nome, CSV e consenso sono obbligatori" }, { status: 400 });
  try { const job = await enqueue(session.user.id, parsed.data); requestLogger().info("personal_import.queued", { jobId: job.id }); return Response.json(job, { status: 202 }); }
  catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Impossibile caricare il CSV" }, { status: 400 }); }
});
