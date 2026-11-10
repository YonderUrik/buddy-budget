import { WebSocket } from "undici";
import { TradeRepublicError, type TradeRepublicSession } from "./client";
import { describeShape, tradeRepublicDebug } from "./debug";

const SOCKET_TIMEOUT_MS = 15_000;
const MAX_FRAME_BYTES = 5 * 1024 * 1024;
/** Read-only topics: cash balance, timeline and activity-log pages, one event's detail, current positions. */
export type TradeRepublicTopic = "cash" | "timelineTransactions" | "timelineActivityLog" | "timelineDetailV2" | "compactPortfolioByType";
/** A subscription Trade Republic refused (error frame): only that read fails, the connection stays usable. */
export class TradeRepublicSubscriptionError extends TradeRepublicError {
  constructor(public readonly codes: string[]) { super("unavailable"); this.name = "TradeRepublicSubscriptionError"; }
}
export interface TradeRepublicReader {
  read(topic: TradeRepublicTopic, params?: Record<string, string>): Promise<unknown>;
  close(): void;
}

/**
 * One-shot, read-only subscriptions on one cookie-authenticated connection. No order/trading methods. `locale` sets
 * the language of titles and detail rows: investment details are read in German, the layout open-source clients map.
 */
export async function openTradeRepublicReader(session: TradeRepublicSession, locale: "en" | "de" = "en"): Promise<TradeRepublicReader> {
  const socket = new WebSocket("wss://api.traderepublic.com", { headers: {
    Cookie: Object.entries(session.cookies).map(([name, value]) => `${name}=${value}`).join("; "),
    Origin: "https://app.traderepublic.com",
  } });
  let nextId = 0;
  let authenticated = false;
  let pending: { id: string; topic: TradeRepublicTopic; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  let connectResolve: () => void;
  let connectReject: (error: Error) => void;
  const connected = new Promise<void>((resolve, reject) => { connectResolve = resolve; connectReject = reject; });
  const connectTimer = setTimeout(() => fail("unavailable", "connect-timeout"), SOCKET_TIMEOUT_MS);
  function fail(reason: "unavailable" | "expired" = "unavailable", why = "unknown") {
    tradeRepublicDebug("socket.fail", { reason, why, authenticated, pendingTopic: pending?.topic ?? null });
    clearTimeout(connectTimer);
    connectReject(new TradeRepublicError(reason));
    if (pending) { clearTimeout(pending.timer); pending.reject(new TradeRepublicError(reason)); pending = undefined; }
    socket.close();
  }
  socket.addEventListener("open", () => { tradeRepublicDebug("socket.open", { cookieCount: Object.keys(session.cookies).length }); socket.send(`connect 31 ${JSON.stringify({ locale, platformId: "webtrading", platformVersion: "chrome - 146.0.0.0", clientId: "app.traderepublic.com", clientVersion: "5582" })}`); });
  socket.addEventListener("error", event => fail("unavailable", `error:${(event as { error?: { name?: string } }).error?.name ?? "unknown"}`));
  socket.addEventListener("close", ({ code, reason }) => fail(code === 3003 ? "expired" : "unavailable", `close:${code}:${reason.length}`));
  socket.addEventListener("message", ({ data }) => {
    if (typeof data !== "string" || Buffer.byteLength(data) > MAX_FRAME_BYTES) { fail("unavailable", typeof data !== "string" ? "binary-frame" : "frame-too-large"); return; }
    if (data === "connected") { tradeRepublicDebug("socket.connected"); clearTimeout(connectTimer); authenticated = true; connectResolve(); return; }
    if (!authenticated) { fail("expired", `pre-auth-frame:${data.length}`); return; }
    const match = /^(\d+) ([A-Z])(?: ([\s\S]*))?$/.exec(data);
    tradeRepublicDebug("socket.frame", { matched: !!match, id: match?.[1] ?? null, kind: match?.[2] ?? null, bytes: Buffer.byteLength(data), pendingId: pending?.id ?? null, pendingTopic: pending?.topic ?? null }, { trail: false });
    if (!match || !pending || match[1] !== pending.id) return;
    // Each new subscription must begin with a complete A frame. Deltas cannot be mistaken for snapshots.
    if (match[2] === "D") { fail("unavailable", "delta-before-snapshot"); return; }
    if (match[2] === "E") {
      const current = pending; pending = undefined; clearTimeout(current.timer);
      socket.send(`unsub ${current.id}`);
      current.reject(new TradeRepublicSubscriptionError(debugErrorFrame(match[3])));
      return;
    }
    if (match[2] === "C") { fail("unavailable", "subscription-closed"); return; }
    if (match[2] !== "A") return;
    const current = pending; pending = undefined; clearTimeout(current.timer);
    socket.send(`unsub ${current.id}`);
    try { current.resolve(JSON.parse(match[3] ?? "null")); }
    catch { current.reject(new TradeRepublicError("invalid-response")); }
  });
  await connected;
  return {
    read(topic, params = {}) {
      if (pending || socket.readyState !== WebSocket.OPEN) return Promise.reject(new TradeRepublicError("unavailable"));
      const id = String(++nextId);
      return new Promise((resolve, reject) => {
        pending = { id, topic, resolve, reject, timer: setTimeout(() => fail("unavailable", `read-timeout:${topic}`), SOCKET_TIMEOUT_MS) };
        tradeRepublicDebug("socket.sub", { id, topic, params: Object.keys(params) }, { trail: false });
        socket.send(`sub ${id} ${JSON.stringify({ type: topic, ...params })}`);
      });
    },
    close: () => socket.close(),
  };
}

/** Error codes of a TR error frame (messages and fields stay out of logs). */
function debugErrorFrame(payload: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(payload ?? "null");
    const errors = parsed && typeof parsed === "object" && "errors" in parsed && Array.isArray(parsed.errors) ? parsed.errors as { errorCode?: unknown }[] : [];
    const codes = errors.map(error => String(error?.errorCode ?? "missing"));
    tradeRepublicDebug("socket.error_frame", { codes, shape: describeShape(parsed) });
    return codes;
  } catch { tradeRepublicDebug("socket.error_frame", { unparsable: true }); return ["unparsable"]; }
}
