# Correzione di un import già completato

Verifica locale del 16 ottobre 2026 su database PostgreSQL temporaneo, eliminato al termine. Solo dati sintetici; nessun CSV dell’utente. OpenRouter reale con ZDR, email intercettate localmente (nessuna consegna reale).

## Prova browser → API → worker → AI → database

1. Un parser sintetico volutamente errato importa gli importi al 90%: due movimenti, saldo **888,75 €**.
2. Dal dettaglio si sceglie **Il risultato è sbagliato**, si descrive l’errore, si ricarica lo stesso file e si autorizza la nuova analisi.
3. Il nuovo parser AI produce **987,50 €**; il saldo salvato resta **888,75 €** e il nuovo parser non è ancora quello riutilizzabile.
4. La schermata confronta i dati attuali/proposti. Il pulsante di sostituzione è disabilitato finché non si conferma di aver controllato il confronto.
5. Dopo la conferma: saldo **987,50 €**, ancora **2 movimenti**, nessun duplicato. File, anteprima e segnalazione cifrata eliminati.
6. Controllata anche la versione mobile a 390 px: nessun overflow orizzontale della pagina.

Risultati leggibili dalla macchina: [result.json](result.json). Schermate: [segnalazione](report.png), [confronto](comparison.png), [mobile](comparison-mobile.png), [completato](replaced.png).

## Controlli automatici

88 test passati (14 file), inclusi:
- transazione di sostituzione e idempotenza;
- rollback di cancellazione, ricevute e saldo se il nuovo import fallisce;
- modifica manuale dell’originale dopo la richiesta: sostituzione bloccata;
- isolamento utenti, consenso corrente, origine delle richieste e limite della segnalazione;
- annullamento, scadenza e blocco dell’annullamento dopo una conferma;
- nuova segnalazione passata al generatore; parser non pubblicato prima dell’approvazione;
- regressioni degli import esistenti e completezza delle traduzioni.

TypeScript ed ESLint sui file modificati: superati.

## Riproduzione

Con Postgres/Redis locali e credenziali OpenRouter in `.env.local`, fermare temporaneamente altri `next dev` dello stesso checkout per liberare il lock, quindi:

```sh
PLAYWRIGHT_MODULE=/percorso/assoluto/playwright \
CHROMIUM_PATH=/percorso/assoluto/chromium \
node scripts/e2e/run-import-fallback.cjs --correction
```

Il runner crea un database dedicato, applica tutte le migrazioni, avvia app sulla porta 3317 e worker, esegue il browser e rimuove il database anche in caso di errore. Le email vengono catturate; la richiesta AI usa esclusivamente il CSV sintetico incluso nello script.

Limite mantenuto: la correzione non riconcilia più import dipendenti. Se rimuovere gli acquisti originali renderebbe scoperte vendite successive, la sostituzione viene bloccata senza modifiche.
