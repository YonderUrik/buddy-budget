// Dopo `next build`: per ogni pagina HTML di out/ scrive la versione Markdown (stesso percorso, estensione .md) e
// out/_markdown-tokens.conf: le mappe di nginx che dicono quali URL hanno un .md ($md_target) e quanti token pesa (x-markdown-tokens). nginx serve il .md quando la richiesta
// ha `Accept: text/markdown` (vedi nginx.conf). Il contenuto è quello di <main>: nav e footer sono ripetuti su ogni pagina.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import TurndownService from "turndown";

const OUT = new URL("../out", import.meta.url).pathname;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io").replace(/\/$/, "");
/** Stima grossolana dei token (≈ 4 caratteri l'uno), la stessa che usa Cloudflare per x-markdown-tokens. */
const CHARS_PER_TOKEN = 4;
const SKIP = new Set(["404.html", "_not-found.html"]);

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", linkStyle: "inlined" });
td.remove(["script", "style", "noscript", "svg", "button", "form", "template", "nav"]);
td.addRule("hidden", { filter: (n) => n.getAttribute?.("aria-hidden") === "true" || n.hasAttribute?.("hidden"), replacement: () => "" });
td.addRule("abs", {
  filter: (n) => n.nodeName === "A" && /^\//.test(n.getAttribute("href") ?? ""),
  replacement: (content, n) => `[${content.trim()}](${SITE_URL}${n.getAttribute("href")})`,
});
// Le schermate esistono in versione chiara e scura: nel Markdown basta una (la chiara).
td.addRule("img", {
  filter: "img",
  replacement: (_c, n) => {
    const alt = (n.getAttribute("alt") ?? "").trim();
    return alt && !/\/dark\//.test(n.getAttribute("src") ?? "") ? `![${alt}](${new URL(n.getAttribute("src") ?? "", SITE_URL + "/")})` : "";
  },
});

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "_next" ? [] : htmlFiles(p);
    return p.endsWith(".html") && !SKIP.has(relative(OUT, p)) ? [p] : [];
  });
}

const pick = (html, re) => html.match(re)?.[1]?.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&") ?? "";

const map = [];
for (const file of htmlFiles(OUT)) {
  const html = readFileSync(file, "utf8");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0];
  if (!main) continue;
  const title = pick(html, /<title>([\s\S]*?)<\/title>/);
  const description = pick(html, /<meta name="description" content="([^"]*)"/);
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
  // L'H1 della pagina è già il titolo qui sopra (quello della home è un testo animato che in Markdown si legge male).
  const body = td.turndown(main.replace(/<h1[\s\S]*?<\/h1>/, "")).replace(/\n{3,}/g, "\n\n").trim();
  const md = `# ${title}\n\n${description ? `> ${description}\n\n` : ""}${canonical ? `Fonte: ${canonical}\n\n` : ""}${body}\n`;
  writeFileSync(file.replace(/\.html$/, ".md"), md);
  // Chiave = $uri dopo il rewrite di nginx (/pagina.md, /index.md per la home).
  const mdPath = "/" + relative(OUT, file).replace(/\.html$/, ".md");
  const url = mdPath === "/index.md" ? "/" : mdPath.replace(/\.md$/, "");
  map.push({ mdPath, url, tokens: Math.ceil(md.length / CHARS_PER_TOKEN) });
}
// Chiave di $md_target = "1" (Accept con text/markdown, vedi $wants_markdown in nginx.conf) + URI richiesto: solo le pagine con un .md.
const targets = map.flatMap((m) => (m.url === "/" ? [["1/", m.mdPath]] : [[`1${m.url}`, m.mdPath], [`1${m.url}/`, m.mdPath]]));
const conf = [
  "map $wants_markdown$uri $md_target {",
  '    default "";',
  ...targets.map(([k, v]) => `    "${k}" ${v};`),
  "}",
  "map $uri $markdown_tokens {",
  "    default 0;",
  ...map.map((m) => `    "${m.mdPath}" ${m.tokens};`),
  "}",
  "",
].join("\n");
writeFileSync(join(OUT, "_markdown-tokens.conf"), conf);
console.log(`generate-markdown: ${map.length} pagine`);
