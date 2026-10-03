## Prima

<!-- Cosa vede o non può fare oggi chi usa l'app. -->

## Dopo

<!-- Cosa cambia per chi usa l'app. -->

## Come

<!-- In breve: cosa fa la modifica e come l'hai verificata (test, prove in browser). -->

## Controlli

- [ ] `pnpm lint`, `pnpm test` e `pnpm exec tsc --noEmit` passano
- [ ] Se cambia lo schema del database: migration generata e committata
- [ ] Se cambia una funzione visibile: `lib/features/catalog.ts` e landing aggiornati (o «nessun impatto sulla landing»)
- [ ] Nessun dato personale o segreto nel codice, nei test o negli screenshot
- [ ] Osservabilità: log, evento Umami, metriche, oppure «nessun nuovo segnale»
- [ ] Se è una PR di release (`pnpm release:prepare`): changelog riletto, versione uguale in `package.json` e `landing/package.json`
