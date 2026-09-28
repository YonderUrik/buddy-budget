import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { ProviderContext } from "../types";

/** Legge una fixture da `__fixtures__` (solo per i test). */
export function readFixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

/** Contesto con un `fetch` finto che restituisce sempre la stessa risposta e registra gli URL chiamati. */
export function fakeContext(body: string, status = 200, env: Record<string, string> = {}): ProviderContext & { urls: string[] } {
  const urls: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(body, { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, env, urls };
}
