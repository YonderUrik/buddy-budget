import { describe, expect, it } from "vitest";
import { MAX_STACK_LINES, createLogger, type LogLevel } from "./logger";

function capture(level: LogLevel = "debug") {
  const lines: { record: Record<string, unknown>; level: LogLevel }[] = [];
  const log = createLogger({ level, write: (line, lvl) => lines.push({ record: JSON.parse(line), level: lvl }) });
  return { log, lines };
}

describe("createLogger", () => {
  it("scrive una riga JSON con i campi standard", () => {
    const { log, lines } = capture();
    log.info("test.event.done", { count: 3 });
    expect(lines).toHaveLength(1);
    expect(lines[0].record).toMatchObject({ level: "info", event: "test.event.done", service: "buddy-budget", count: 3 });
    expect(typeof lines[0].record.ts).toBe("string");
  });

  it("rispetta il livello minimo", () => {
    const { log, lines } = capture("warn");
    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");
    expect(lines.map((l) => l.record.event)).toEqual(["c", "d"]);
  });

  it("child eredita i campi e può sovrascriverli", () => {
    const { log, lines } = capture();
    const child = log.child({ requestId: "r1", route: "x.list" });
    child.info("e", { route: "x.get" });
    expect(lines[0].record).toMatchObject({ requestId: "r1", route: "x.get" });
  });

  it("serializza l'errore redigendo il messaggio, con stack solo a livello error", () => {
    const { log, lines } = capture();
    const err = new Error("invio a mario@example.com fallito");
    log.error("mail.failed", { error: err });
    log.warn("mail.retry", { error: err });
    const e1 = lines[0].record.error as Record<string, string>;
    const e2 = lines[1].record.error as Record<string, string>;
    expect(e1.message).toBe("invio a [email] fallito");
    expect(e1.stack).toBeDefined();
    expect(e1.stack).not.toContain("mario@example.com");
    expect(e2.stack).toBeUndefined();
  });

  it("gestisce valori non-Error e riferimenti circolari senza lanciare", () => {
    const { log, lines } = capture();
    const err = new Error("boom") as Error & { cause?: unknown };
    err.cause = err;
    expect(() => log.error("x", { error: err })).not.toThrow();
    log.error("y", { error: "stringa semplice" });
    expect((lines[1].record.error as Record<string, string>).message).toBe("stringa semplice");
  });

  it("include la causa redatta (es. errore Postgres dentro un errore Drizzle)", () => {
    const { log, lines } = capture();
    const err = new Error("Failed query: select 1\nparams: mario@example.com", {
      cause: new Error('duplicate key value violates unique constraint "x"'),
    });
    log.error("db.failed", { error: err });
    const e = lines[0].record.error as { message: string; stack: string; cause: { message: string } };
    expect(e.cause.message).toBe('duplicate key value violates unique constraint "x"');
    expect(e.message).not.toContain("mario");
    expect(e.stack).not.toContain("mario");
  });

  it("tronca lo stack alle prime righe", () => {
    const { log, lines } = capture();
    const err = new Error("boom");
    err.stack = ["Error: boom", ...Array.from({ length: 40 }, (_, i) => `    at frame${i}`)].join("\n");
    log.error("x", { error: err });
    expect((lines[0].record.error as { stack: string }).stack.split("\n")).toHaveLength(MAX_STACK_LINES);
  });

  it("warn ed error vanno al writer con il proprio livello", () => {
    const { log, lines } = capture();
    log.warn("w");
    log.error("e");
    expect(lines.map((l) => l.level)).toEqual(["warn", "error"]);
  });

  it("un writer che lancia non propaga l'errore", () => {
    const log = createLogger({ level: "info", write: () => { throw new Error("stdout chiuso"); } });
    expect(() => log.info("x")).not.toThrow();
  });
});
