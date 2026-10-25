import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { dataEncryptionKey } from "@/lib/crypto/field-encryption";
import { getUserCurrency } from "@/lib/investments/operations";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { resolveProfile } from "@/lib/localization/config";
import { bindRequestUser, requestLogger, recordTradeRepublicRequest, withRoute } from "@/lib/observability";
import { createTradeRepublicClient, TradeRepublicError, connectTradeRepublic, prepareTradeRepublicSync, runTradeRepublicSync, readPendingLogin, savePendingLogin, clearPendingLogin, allowTradeRepublicAttempt, withTradeRepublicLoginLock } from "@/lib/trade-republic";

export const maxDuration = 300;
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/), pin: z.string().regex(/^\d{4}$/) }).strict(),
  z.object({ action: z.literal("poll") }).strict(),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }).strict(),
]);
const privateHeaders = { "Cache-Control": "private, no-store" };

async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json({ pending: !!await readPendingLogin(session.user.id), configured: !!dataEncryptionKey() }, { headers: privateHeaders });
}

async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (request.headers.get("origin") !== new URL(process.env.APP_URL || request.url).origin) return new Response(null, { status: 403 });
  const demoBlock = await rejectIfDemoActive(session.user.id, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;
  if (!dataEncryptionKey()) return Response.json({ error: "Il collegamento Trade Republic non è configurato su questa installazione." }, { status: 503 });
  if (await getUserCurrency(session.user.id) !== "EUR") return Response.json({ error: "Il collegamento Trade Republic richiede un conto e una valuta principale in EUR." }, { status: 422 });
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return new Response(null, { status: 413 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Controlla il numero con prefisso internazionale, il PIN e il codice di verifica." }, { status: 400 });
  const input = parsed.data;
  const userId = session.user.id;
  if (!await allowTradeRepublicAttempt(userId, input.action === "login" ? "login" : "poll", input.action === "login" ? 5 : 40, input.action === "login" ? 900 : 60)) return Response.json({ error: "Troppi tentativi. Attendi prima di riprovare." }, { status: 429 });
  const started = performance.now();
  try {
    const response = await withTradeRepublicLoginLock(userId, async () => {
      if (input.action === "login") {
        const pending = { cookies: {}, deviceId: randomUUID() };
        await createTradeRepublicClient(pending).login(input.phoneNumber, input.pin);
        await savePendingLogin(userId, pending, true);
        requestLogger().info("trade_republic.login.started");
        return Response.json({ status: "pending", needsAuthenticator: false }, { headers: privateHeaders });
      }
      const pending = await readPendingLogin(userId);
      if (!pending) throw new TradeRepublicError("expired");
      const client = createTradeRepublicClient(pending);
      if (input.action === "verify") await client.verifyAuthenticator(input.code);
      const state = await client.loginState();
      if (state.status === "pending") {
        await savePendingLogin(userId, pending);
        return Response.json(state, { headers: privateHeaders });
      }
      const accountId = await connectTradeRepublic(userId, pending);
      await clearPendingLogin(userId);
      const result = await prepareTradeRepublicSync(userId, accountId, true);
      if (result.status !== "started") return Response.json({ error: "Il conto è già in sincronizzazione. Segui l'avanzamento nel pannello." }, { status: 409 });
      after(() => runTradeRepublicSync(userId, accountId, result.job.id));
      requestLogger().info("trade_republic.login.completed");
      recordTradeRepublicRequest("login", "success", performance.now() - started);
      return Response.json({ status: "connected", accountId, jobId: result.job.id }, { status: 202, headers: privateHeaders });
    });
    return response ?? Response.json({ error: "Una richiesta è già in corso. Riprova tra poco." }, { status: 409 });
  } catch (error) {
    const reason = error instanceof TradeRepublicError ? error.reason : "unavailable";
    requestLogger().warn("trade_republic.login.failed", { reason });
    recordTradeRepublicRequest("login", "error", performance.now() - started);
    const messages = {
      expired: "La sessione Trade Republic è scaduta o l'accesso è stato rifiutato. Accedi di nuovo.",
      "rate-limited": "Troppi tentativi. Attendi prima di riprovare.",
      "existing-import": "Hai già importato Trade Republic da un file. Per evitare doppioni, il collegamento diretto richiede prima la rimozione di quell'importazione.",
    };
    return Response.json({ error: messages[reason as keyof typeof messages] ?? "Trade Republic non è disponibile o ha cambiato il collegamento. Riprova più tardi." }, { status: reason === "expired" ? 410 : reason === "rate-limited" ? 429 : 502, headers: privateHeaders });
  }
}
async function handleDelete(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (request.headers.get("origin") !== new URL(process.env.APP_URL || request.url).origin) return new Response(null, { status: 403 });
  const response = await withTradeRepublicLoginLock(session.user.id, async () => { await clearPendingLogin(session.user.id); return new Response(null, { status: 204 }); });
  return response ?? new Response(null, { status: 409 });
}
export const GET = withRoute("trade_republic.login.status", handleGet, { quietOnSuccess: true });
export const POST = withRoute("trade_republic.login", handlePost, { quietOnSuccess: true });
export const DELETE = withRoute("trade_republic.login.cancel", handleDelete);
