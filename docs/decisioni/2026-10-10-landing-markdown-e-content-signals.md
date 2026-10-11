# Landing: Markdown per gli agenti e Content-Signal

Data: 2026-10-10

- **Markdown negotiation**: la landing è statica e servita da nginx nel cluster, quindi niente regola Cloudflare (Markdown for Agents è una funzione dei piani a pagamento e non la controlliamo). Dopo `next build`, `landing/scripts/generate-markdown.mjs` scrive un `.md` accanto a ogni pagina (contenuto di `<main>`, titolo, descrizione, canonical) e le mappe nginx `$md_target` / `$markdown_tokens`. Con `Accept: text/markdown` nginx serve il `.md` con `x-markdown-tokens`; senza, HTML. `Vary: Accept` su tutte le pagine; `*/*`, browser e Googlebot ricevono HTML.
- **Content-Signal** in `/robots.txt` (ora `app/robots.txt/route.ts`, perché `robots.ts` di Next non lo supporta): `ai-train=yes, search=yes, ai-input=yes`, ripetuto anche nel gruppo dei crawler AI. Scelta coerente con sito pubblico, codice AGPL e crawler AI già ammessi. Per vietare l'addestramento: `ai-train=no` in `landing/content/robots.ts` e togliere dall'elenco i crawler di solo training.
- Nessun impatto sull'app né sul catalogo funzioni.
