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
- [ ] Se cambia l'interfaccia: tastiera, etichette, contrasto (chiaro e scuro) e `prefers-reduced-motion` controllati, oppure «nessun impatto sull'accessibilità» (vedi [`ACCESSIBILITY.md`](../ACCESSIBILITY.md))
- [ ] Nessun dato personale o segreto nel codice, nei test o negli screenshot
- [ ] Osservabilità: log, evento Umami, metriche, oppure «nessun nuovo segnale»
- [ ] Il titolo è in formato Conventional Commits (`feat: …`, `fix: …`, `chore: …`): da lì si calcola la versione (vedi `docs/rilasci.md`)
