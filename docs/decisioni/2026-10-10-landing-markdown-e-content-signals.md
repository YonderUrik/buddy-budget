# Landing: Markdown for agents and Content-Signal

Date: 2026-10-10

- **Markdown negotiation**: the landing is static and served by nginx in the cluster, so no Cloudflare rule (Markdown for Agents is a paid-plan feature and we do not control it). After `next build`, `landing/scripts/generate-markdown.mjs` writes a `.md` next to every page (content of `<main>`, title, description, canonical) and the nginx maps `$md_target` / `$markdown_tokens`. With `Accept: text/markdown` nginx serves the `.md` with `x-markdown-tokens`; without, HTML. `Vary: Accept` on all pages; `*/*`, browsers and Googlebot receive HTML.
- **Content-Signal** in `/robots.txt` (now `app/robots.txt/route.ts`, because Next's `robots.ts` does not support it): `ai-train=yes, search=yes, ai-input=yes`, also repeated in the AI crawlers group. A choice consistent with a public site, AGPL code and AI crawlers already allowed. To forbid training: `ai-train=no` in `landing/content/robots.ts` and remove the training-only crawlers from the list.
- No impact on the app or on the feature catalog.
