# Landing di BuddyBudget

Sito statico (Next.js `output: "export"`) servito su `https://buddybudget.io`. L'app vera è su `https://app.buddybudget.io` (repo radice, cartelle `app/`, `components/`, ecc.). Progetto indipendente: ha il suo `package.json` e il suo lockfile.

```
cd landing
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # genera out/
pnpm lint     # tsc --noEmit
```

## Regole

- **Funzionalità**: elenco e descrizioni vengono da `../lib/features` (copiato in `.shared/` da `pnpm sync:features`, prima di dev/build/lint; import `@features`), la stessa fonte del pannello "In arrivo" del login. Non duplicarle nei componenti: ogni feature nuova si aggiunge al catalogo, e la landing la mostra da sola.
- **Link all'app**: sempre verso `https://app.buddybudget.io`, con `utm_source=landing`.
- **Analytics**: sito Umami dedicato ("BuddyBudget Landing"), separato da quello dell'app. Eventi con props solo categoriche.
- **Redirect dei vecchi indirizzi** dell'app: `public/_redirects`.

## Pubblicazione (Cloudflare Pages, collegato alla repo)

Root directory `landing`, build command `pnpm install && pnpm build`, output `out`. Dominio personalizzato `buddybudget.io`; `www.buddybudget.io` → `buddybudget.io` con una regola di redirect Cloudflare.
