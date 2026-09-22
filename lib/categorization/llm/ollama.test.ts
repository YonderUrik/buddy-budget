import { afterEach, describe, expect, it, vi } from "vitest";
import { getSuggester } from "./index";
import { createOllamaSuggester } from "./ollama";

const categories = [
  { id: "cat-spesa", name: "Spesa alimentare", type: "voluta", isFallback: false },
  { id: "cat-casa", name: "Affitto & Mutuo", type: "dovuta", isFallback: false },
] as never;

const input = [{ index: 0, description: "esselunga via roma", amount: -30 }];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("getSuggester", () => {
  it("ritorna null quando OLLAMA_BASE_URL non è configurata", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect(getSuggester()).toBeNull();
  });

  it("ritorna un suggester quando la configurazione è presente", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2");
    expect(getSuggester()).not.toBeNull();
  });
});

describe("createOllamaSuggester", () => {
  it("mappa la risposta del modello sulle categorie dell'utente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: JSON.stringify([{ index: 0, categoryName: "Spesa alimentare", confidence: 0.8 }]) }))
    );
    const result = await createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories);
    expect(result).toEqual([{ index: 0, categoryName: "Spesa alimentare", confidence: 0.8 }]);
  });

  it("ritorna un array vuoto quando la connessione fallisce", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto su risposta HTTP di errore", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto quando la risposta non è JSON valido", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ response: "non sono json" })));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("scarta le proposte su categorie che non esistono fra quelle dell'utente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: JSON.stringify([{ index: 0, categoryName: "Categoria Inventata", confidence: 0.9 }]) }))
    );
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto senza transazioni da valutare, senza chiamare il modello", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest([], categories)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ritorna un array vuoto dopo 10s se il modello non risponde", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          const signal = (options as RequestInit).signal;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
    );

    const promise = createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual([]);
  });
});
