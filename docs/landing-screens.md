# Schermate della landing: come restano vere

Le immagini dell'app che si vedono su buddybudget.io non sono disegnate: sono **screenshot dell'app vera**, fatti con dati di esempio. Così la landing non può mostrare una schermata che l'app non ha.

## Come funziona

1. **Dati di esempio** (`scripts/demo-seed.ts`): crea in un database vuoto un utente fittizio ("Giulia Demo") con conti, ~300 movimenti, investimenti, un mutuo e una linea Lombard. I numeri sono deterministici (stesso risultato a ogni esecuzione) e lo storico del patrimonio è calcolato dal codice vero (`snapshotUser`). Rifiuta di girare su un DB che contiene altri utenti.
2. **App vera**: `next build && next start` con `DATABASE_URL` che punta a quel DB.
3. **Cattura** (`landing/scripts/capture-screens.mjs`): Playwright apre ogni schermata elencata in `landing/content/screens.ts`, con un cookie di sessione firmato per l'utente demo, in tema chiaro e scuro, e salva `landing/public/screens/{light,dark}/<id>.jpg` (1280×800 a 1,5x) più `manifest.json`.
4. **Landing**: il componente `AppShot` mostra l'immagine del tema corrente; galleria, hero e tour usano solo queste immagini.

## Cosa impedisce che diventino false

- `landing/content/screens.test.ts` (gira nella CI della landing): ogni schermata deve puntare a una route che esiste in `app/(app)/` e avere le due immagini. Se una route viene rinominata o tolta, il test fallisce.
- Un cambio **grafico** dell'app non fa fallire nulla: va rilanciata la cattura (sotto). Regola: chi cambia in modo visibile una schermata dell'elenco rigenera gli screenshot nella stessa PR.

## Rigenerare gli screenshot

Servono Postgres, Redis e un Chromium con Playwright.

```bash
createdb bb_demo
export DATABASE_URL=postgresql://USER:PASS@localhost:5432/bb_demo REDIS_URL=redis://localhost:6379 \
  BETTER_AUTH_SECRET=<un segreto qualsiasi> BETTER_AUTH_URL=http://localhost:3300 APP_URL=http://localhost:3300
pnpm db:migrate
pnpm demo:seed
pnpm build && pnpm exec next start -p 3300 &
cd landing && PLAYWRIGHT_MODULE=<percorso di playwright> pnpm capture:screens
```

`BETTER_AUTH_SECRET` deve essere lo stesso per app e cattura (firma il cookie). Variabili opzionali: `DEMO_APP_URL`, `CHROMIUM_PATH`.

Il workflow GitHub `landing-screens.yml` (avvio manuale) fa gli stessi passi e carica le immagini come artifact da scaricare e committare. **Non è ancora stato eseguito su GitHub.**

## Aggiungere una schermata

Aggiungi una voce a `SCREENS` in `landing/content/screens.ts` (id, area, route reale, didascalia), rilancia la cattura e committa le immagini. Se la schermata ha bisogno di dati che il seed non crea, estendi `scripts/demo-seed.ts`.
