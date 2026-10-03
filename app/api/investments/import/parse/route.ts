import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { IBKR_MAX_FILE_BYTES, parseInteractiveBrokersActivity } from "@/lib/investments/import/interactive-brokers";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Raw CSV body; bounded while streaming, including when Content-Length is absent or incorrect. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "text/csv" && contentType !== "text/plain") return respond({ error: "Inviare il CSV come text/csv o text/plain" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: "File mancante" }, 400);
  let size = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > IBKR_MAX_FILE_BYTES) {
        await reader.cancel();
        return respond({ error: "File troppo grande (massimo 5 MB)" }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return respond({ error: "Impossibile leggere il file CSV UTF-8" }, 400);
  } finally {
    reader.releaseLock();
  }
  try {
    const result = parseInteractiveBrokersActivity(text, new Date().toISOString().slice(0, 10));
    return respond(result);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "File non valido" }, 400);
  }
}

export const POST = withRoute("investment_import.parse", handlePost);
