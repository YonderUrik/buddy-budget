import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, buildRobotsTxt } from "./robots";

describe("robots.txt", () => {
  const txt = buildRobotsTxt();

  it("dichiara le preferenze Content-Signal sotto User-agent: * e non lascia ambiguo nessun segnale", () => {
    expect(txt).toMatch(/^User-agent: \*\nContent-Signal: ai-train=(yes|no), search=(yes|no), ai-input=(yes|no)\nAllow: \/$/m);
  });

  it("ripete il segnale anche nel gruppo dei crawler AI", () => {
    expect(txt.match(/^Content-Signal:/gm)).toHaveLength(2);
  });

  it("ammette tutti i crawler AI elencati e indica la sitemap", () => {
    for (const ua of AI_CRAWLERS) expect(txt).toContain(`User-agent: ${ua}\n`);
    expect(txt).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });
});
