import { describe, expect, it } from "vitest";
import { formatFileSize, readPersonalImportFile } from "./personal-import-upload";

describe("formatFileSize", () => {
  it("mostra KB sotto il mega e MB sopra", () => {
    expect(formatFileSize(10)).toBe("1 KB");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("readPersonalImportFile", () => {
  it("legge un CSV come testo", async () => {
    const loaded = await readPersonalImportFile(new File(["a;b\n1;2"], "movimenti.csv", { type: "text/csv" }));
    expect(loaded).toMatchObject({ name: "movimenti.csv", csv: "a;b\n1;2" });
  });
  it("rifiuta i vecchi .xls con indicazioni su cosa fare", async () => {
    await expect(readPersonalImportFile(new File(["x"], "vecchio.xls"))).rejects.toThrow(/xlsx/);
  });
});
