import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { importSupportReport } from "./support-report";

describe("support report", () => {
  it("lists every attempt and the broker reader's refusal, without file text", () => {
    const { text } = importSupportReport("job-1", "imported", 1, {
      phase: "parse", reason: "native_refused", detail: "Interactive Brokers", fallback: true,
      native: { provider: "interactive-brokers", name: "Interactive Brokers", message: "Cassa EUR non riconciliata" },
      attempts: [{ step: 1, model: "deepseek/deepseek-v4.1-flash", reason: "unrecognized_rows", detail: "28 righe su 499 non riconosciute", count: 28, rows: [263, 264] }],
    });
    expect(text).toContain("Lettore Interactive Brokers: ha letto il file e l'ha rifiutato con «Cassa EUR non riconciliata»");
    expect(text).toContain("- tentativo 1 (Flash), deepseek/deepseek-v4.1-flash: Il parser non ha riconosciuto tutte le righe del documento. (28 righe su 499 non riconosciute); righe 263, 264");
  });
});
