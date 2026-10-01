# Landing di BuddyBudget

Sito vetrina statico di `buddybudget.io`. Progetto Next.js indipendente dall'app (proprio `package.json`, lockfile e CI): produce solo file statici in `out/`, senza server né accesso al database.

```
pnpm install
pnpm dev          # http://localhost:3100
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # genera out/
```

## Dove si cambia cosa

- `content/features.ts`: **unico elenco delle funzioni** (catalogo, conteggi). Si aggiorna a ogni feature nuova o cambiata (regola in `CLAUDE.md`).
- `content/site.ts`: titoli, passi del tour, storia, righe del confronto, fondatore.
- `content/demo.ts`: dati finti mostrati nella finestra dell'app (nessun dato reale).
- `components/`: sezioni e animazioni (GSAP + ScrollTrigger, scroll morbido con Lenis). Con `prefers-reduced-motion: reduce` la pagina resta statica.

## Variabili d'ambiente (tutte pubbliche, lette in fase di build)

| Variabile | Default | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://buddybudget.io` | URL canonico, sitemap, Open Graph |
| `NEXT_PUBLIC_APP_URL` | `https://app.buddybudget.io` | destinazione di "Accedi" e "Crea il tuo account" |
| `NEXT_PUBLIC_UMAMI_SRC` | `<APP_URL>/stats/script.js` | script Umami (proxy dell'app) |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | vuoto | id del sito Umami **della landing**; senza, nessun tracciamento |

## Deploy su Cloudflare Pages

Root directory `landing`, comando `pnpm build`, output `out`, Node 24. Gli header di sicurezza sono in `public/_headers`, i redirect dei vecchi percorsi dell'app verso `app.buddybudget.io` in `public/_redirects`.

## Eventi Umami

`cta_click` (location, target), `section_view`, `tour_step_viewed`, `catalog_area_selected`, `simulator_used`, `hide_amounts_toggled`, `theme_toggled`. Il tipo chiuso è in `lib/analytics.ts`: props solo categoriche, mai dati personali.
