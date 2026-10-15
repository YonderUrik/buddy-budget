import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const profiles = [["IT","it",""],["IT","it","/it/it"],["IT","en","/it/en"],["DE","de","/de/de"],["DE","en","/de/en"]];
const staging = mkdtempSync(join(tmpdir(), "bb-landing-export-"));
try {
  for (const [country, language, base] of profiles) {
    console.log(`Building ${base || "entry point"}`);
    rmSync(".next", { recursive: true, force: true });
    rmSync("out", { recursive: true, force: true });
    const env = { ...process.env, NEXT_PUBLIC_LANDING_COUNTRY: country, NEXT_PUBLIC_LANDING_LANGUAGE: language, NEXT_PUBLIC_LANDING_BASE_PATH: base };
    const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], { env, stdio: "inherit" });
    if (build.status !== 0) throw new Error(`Build failed: ${base}`);
    const destination = join(staging, base);
    mkdirSync(destination, { recursive: true });
    cpSync("out", destination, { recursive: true });
  }
  rmSync("out", { recursive: true, force: true });
  cpSync(staging, "out", { recursive: true });
  // Root sitemap includes every profile; individual page alternates carry country-aware hreflang.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io").replace(/\/$/, "");
  const urls = [];
  function collect(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir,e.name); if (e.isDirectory() && e.name !== "_next") collect(p); else if(e.isFile() && e.name.endsWith(".html") && !/404|_not-found/.test(p)) { const route = p.slice(3).replace(/\/index\.html$/, "/").replace(/\.html$/, ""); if (/^\/(it|de)\//.test(route) && !(/^\/de\//.test(route) && /zainetto-fiscale|funzioni\/investimenti/.test(route))) urls.push(origin+route); } } }
  collect("out");
  writeFileSync("out/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join("")}</urlset>`);
  const markdown = spawnSync(process.execPath,["scripts/generate-markdown.mjs"],{stdio:"inherit"});
  if(markdown.status!==0) throw new Error("Markdown generation failed");
} finally { rmSync(staging, { recursive: true, force: true }); }
