import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTRUMENTS, WORKS_WITH } from "./story";

const PUBLIC_DIR = join(__dirname, "..", "public");
/** Stesso limite dello script che li scarica: un logo più grande di così non è un logo. */
const MAX_LOGO_BYTES = 100 * 1024;

describe("loghi degli strumenti d'esempio", () => {
  const withLogo = [...INSTRUMENTS, ...WORKS_WITH.rest.chips].filter((chip) => "logo" in chip && chip.logo);

  it("c'è almeno uno strumento con il logo", () => {
    expect(withLogo.length).toBeGreaterThan(0);
  });

  it("ogni logo indicato esiste in public/ ed è piccolo", () => {
    for (const chip of withLogo) {
      const file = join(PUBLIC_DIR, (chip as { logo: string }).logo);
      expect(existsSync(file), chip.name).toBe(true);
      expect(statSync(file).size, chip.name).toBeLessThanOrEqual(MAX_LOGO_BYTES);
    }
  });
});
