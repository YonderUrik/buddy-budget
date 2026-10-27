import { describe, expect, it, vi } from "vitest";
const sockets = vi.hoisted(() => [] as { sent: string[]; emit: (data: string) => void; closed: boolean }[]);
vi.mock("undici", () => ({ WebSocket: class {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  closed = false;
  handlers = new Map<string, ((event: unknown) => void)[]>();
  constructor(public url: string, public options: unknown) { sockets.push(this); queueMicrotask(() => this.handlers.get("open")?.forEach(handler => handler({}))); }
  addEventListener(name: string, handler: (event: unknown) => void) { this.handlers.set(name, [...this.handlers.get(name) ?? [], handler]); }
  send(frame: string) { this.sent.push(frame); if (frame.startsWith("connect")) queueMicrotask(() => this.emit("connected")); }
  emit(data: string) { this.handlers.get("message")?.forEach(handler => handler({ data })); }
  close() { this.closed = true; }
} }));
import { openTradeRepublicReader } from "./socket";
describe("direct Trade Republic WebSocket", () => {
  it("uses one authenticated socket and completes read-only snapshot subscriptions", async () => {
    const reader = await openTradeRepublicReader({ cookies: { JSESSIONID: "synthetic-token" }, deviceId: "device" });
    const socket = sockets.at(-1)!;
    expect(socket.sent[0]).toMatch(/^connect 31 /);
    const cash = reader.read("cash");
    socket.emit('1 A [{"currencyId":"EUR","amount":12}]');
    expect(await cash).toEqual([{ currencyId: "EUR", amount: 12 }]);
    expect(socket.sent.at(-1)).toBe("unsub 1");
    const page = reader.read("timelineTransactions", { after: "cursor" });
    expect(socket.sent.at(-1)).toBe('sub 2 {"type":"timelineTransactions","after":"cursor"}');
    socket.emit('2 A {"items":[]}');
    expect(await page).toEqual({ items: [] });
    reader.close(); expect(socket.closed).toBe(true);
  });
  it("does not accept deltas or upstream errors as complete account data", async () => {
    const reader = await openTradeRepublicReader({ cookies: {}, deviceId: "device" });
    const promise = reader.read("cash");
    sockets.at(-1)!.emit('1 D =3\t+secret');
    await expect(promise).rejects.toThrow("unavailable");
    expect(sockets.at(-1)!.closed).toBe(true);
  });
  it("fails only the refused subscription on an error frame, and keeps the connection for the next read", async () => {
    const reader = await openTradeRepublicReader({ cookies: {}, deviceId: "device" }, "de");
    const socket = sockets.at(-1)!;
    expect(socket.sent[0]).toContain('"locale":"de"');
    const refused = reader.read("compactPortfolioByType", { secAccNo: "1" });
    socket.emit('1 E {"errors":[{"errorCode":"BAD_SUBSCRIPTION_TYPE","errorMessage":"x"}]}');
    await expect(refused).rejects.toMatchObject({ codes: ["BAD_SUBSCRIPTION_TYPE"] });
    expect(socket.closed).toBe(false);
    const cash = reader.read("cash");
    socket.emit('2 A [{"currencyId":"EUR","amount":1}]');
    expect(await cash).toEqual([{ currencyId: "EUR", amount: 1 }]);
  });
});
