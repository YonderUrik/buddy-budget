# 2026-10-10 — Override per le dipendenze transitive vulnerabili

Gli alert Dependabot sulle dipendenze transitive (quasi tutte sotto `shadcn`, usato solo per `shadcn/tailwind.css`, e `drizzle-kit`/`eslint`) non si risolvono con le PR patch automatiche: il pacchetto diretto non cambia versione, quindi Dependabot non ha nulla da proporre.
Si usano gli `overrides` di `pnpm-workspace.yaml`, uno per pacchetto, con intervallo minimo = prima versione corretta. `brace-expansion` resta nella linea 1.x (`^1.1.21`): le 2.x+ cambiano l'export e rompono `minimatch@3` (ESLint).
Resta aperto solo `braces` (dev tooling di `shadcn`): la versione corretta 3.0.4 non è ancora pubblicata su npm. Da ricontrollare con `pnpm audit`.
Quando l'upstream aggiorna le proprie dipendenze, gli override si possono togliere.
