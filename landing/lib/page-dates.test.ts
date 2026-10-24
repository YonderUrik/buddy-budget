import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM build script, no type declarations
import { contentFiles, importsOf, routeOf } from "../scripts/page-dates.mjs";

describe("page-dates", () => {
  it("maps page files to routes without route groups", () => {
    expect(routeOf("(it)/page.tsx")).toBe("/");
    expect(routeOf("(it)/guide/zainetto-fiscale/page.tsx")).toBe("/guide/zainetto-fiscale");
    expect(routeOf("en/calculators/page.tsx")).toBe("/en/calculators");
  });

  it("reads local imports only", () => {
    expect(importsOf('import a from "@/content/site";\nimport "./x.css";\nimport { b } from "next/link";')).toEqual(["@/content/site", "./x.css"]);
  });

  it("dates a page by its own files, not by the ones every page shares", () => {
    const page = (route: string, closure: string[], direct: string[]) => ({ route, file: `${route}/page.tsx`, closure: new Set([`${route}/page.tsx`, ...closure]), direct: new Set(direct) });
    const pages = [
      page("/a", ["nav.tsx", "legal.ts"], ["legal.ts"]),
      page("/b", ["nav.tsx", "legal.ts"], []),
      page("/c", ["nav.tsx", "legal.ts", "guide.ts"], ["guide.ts"]),
    ];
    const files = Object.fromEntries(contentFiles(pages).map((p: { route: string; files: string[] }) => [p.route, p.files.sort()]));
    expect(files["/a"]).toEqual(["/a/page.tsx", "legal.ts"]);
    expect(files["/b"]).toEqual(["/b/page.tsx"]);
    expect(files["/c"]).toEqual(["/c/page.tsx", "guide.ts"]);
  });
});
