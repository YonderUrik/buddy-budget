import { WebSocket } from "undici";
import { TradeRepublicError, type TradeRepublicSession } from "./client";

const SOCKET_TIMEOUT_MS = 15_000;
const MAX_FRAME_BYTES = 5 * 1024 * 1024;
export type TradeRepublicTopic = "cash" | "timelineTransactions";
export interface TradeRepublicReader {
  read(topic: TradeRepublicTopic, after?: string): Promise<unknown>;
  close(): void;
}

/** One-shot, read-only subscriptions on one cookie-authenticated connection. No order/trading methods. */
export async function openTradeRepublicReader(session: TradeRepublicSession): Promise<TradeRepublicReader> {
  const socket = new WebSocket("wss://api.traderepublic.com", { headers: {
    Cookie: Object.entries(session.cookies).map(([name, value]) => `${name}=${value}`).join("; "),
    Origin: "https://app.traderepublic.com",
  } });
  let nextId = 0;
  let authenticated = false;
  let pending: { id: string; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  let connectResolve: () => void;
  let connectReject: (error: Error) => void;
  const connected = new Promise<void>((resolve, reject) => { connectResolve = resolve; connectReject = reject; });
  const connectTimer = setTimeout(() => fail(), SOCKET_TIMEOUT_MS);
  function fail(reason: "unavailable" | "expired" = "unavailable") {
    clearTimeout(connectTimer);
    connectReject(new TradeRepublicError(reason));
    if (pending) { clearTimeout(pending.timer); pending.reject(new TradeRepublicError(reason)); pending = undefined; }
    socket.close();
  }
  socket.addEventListener("open", () => socket.send(`connect 31 ${JSON.stringify({ locale: "en", platformId: "webtrading", platformVersion: "chrome - 146.0.0.0", clientId: "app.traderepublic.com", clientVersion: "5582" })}`));
  socket.addEventListener("error", () => fail());
  socket.addEventListener("close", ({ code }) => fail(code === 3003 ? "expired" : "unavailable"));
  socket.addEventListener("message", ({ data }) => {
    if (typeof data !== "string" || Buffer.byteLength(data) > MAX_FRAME_BYTES) { fail(); return; }
    if (data === "connected") { clearTimeout(connectTimer); authenticated = true; connectResolve(); return; }
    if (!authenticated) { fail("expired"); return; }
    const match = /^(\d+) ([A-Z])(?: ([\s\S]*))?$/.exec(data);
    if (!match || !pending || match[1] !== pending.id) return;
    // Each new subscription must begin with a complete A frame. Deltas cannot be mistaken for snapshots.
    if (match[2] === "D") { fail(); return; }
    if (match[2] === "C" || match[2] === "E") { fail(); return; }
    if (match[2] !== "A") return;
    const current = pending; pending = undefined; clearTimeout(current.timer);
    socket.send(`unsub ${current.id}`);
    try { current.resolve(JSON.parse(match[3] ?? "null")); }
    catch { current.reject(new TradeRepublicError("invalid-response")); }
  });
  await connected;
  return {
    read(topic, after) {
      if (pending || socket.readyState !== WebSocket.OPEN) return Promise.reject(new TradeRepublicError("unavailable"));
      const id = String(++nextId);
      return new Promise((resolve, reject) => {
        pending = { id, resolve, reject, timer: setTimeout(fail, SOCKET_TIMEOUT_MS) };
        socket.send(`sub ${id} ${JSON.stringify({ type: topic, ...(after ? { after } : {}) })}`);
      });
    },
    close: () => socket.close(),
  };
}
