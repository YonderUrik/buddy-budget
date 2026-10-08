# Verifica browser — benchmark predefiniti

Verifica dell'8 ottobre 2026 in Chrome sull'app Next.js locale, con database isolato `buddy_benchmark_demo`, utente Giulia Demo e portafoglio fittizio. I prezzi dei benchmark sono stati scaricati dalle fonti reali, senza `MARKET_DATA_FAKE`.

## Esiti

- Le quattro scelte rapide mostrano indice, descrizione, ETF e ticker. La selezione corrente è marcata «Attuale».
- S&P 500, MSCI World, FTSE All-World e Nasdaq-100 sono stati selezionati e salvati; il confronto numerico compare con i prezzi scaricati.
- Durante la creazione e il salvataggio, pulsanti e ricerca sono disabilitati e compare lo stato di caricamento.
- Nasdaq-100, mai creato prima nel database, è passato dalla selezione al confronto completo senza reload dopo le correzioni.
- Dopo un reload Nasdaq-100 resta selezionato; «Togli il confronto» ripristina «Scegli un confronto».
- La ricerca libera di `CSPX` restituisce risultati di mercato.
- Nessun errore o warning nella console del browser durante il controllo finale.
- Confermati sul server POST strumenti 201 per creazione / 200 per riuso e PATCH portafoglio 200; verificati nel database i prezzi storici salvati.

## Problemi trovati e corretti

1. Il download iniziale di 30 giorni poteva detenere il lock quando il salvataggio del benchmark chiedeva lo storico completo. La finestra benchmark ora crea/riusa lo strumento con `history=deferred`; il salvataggio del portafoglio avvia il recupero dalla prima operazione. Vale anche per la ricerca libera della stessa finestra. La creazione ordinaria mantiene il download iniziale.
2. Se il recupero terminava prima del primo polling, il client non osservava `running` e non rileggeva i prezzi, mostrando un falso errore nonostante lo storico fosse già nel database. Il client ora rilegge la panoramica anche quando vede per la prima volta uno stato concluso nuovo.

## Controlli automatici

- TypeScript e lint: superati.
- 63 test: API strumenti (inclusa regressione sul download differito), rendimenti e insight.
- Catalogo landing sincronizzato; `git diff --check` superato.

## Schermate

- [Suggerimenti e selezione attuale](01-suggestions.jpg)
- [Confronto S&P 500](02-comparison.jpg)
- [Prima selezione Nasdaq-100, aggiornamento automatico](03-nasdaq-first-selection.jpg)
- [Confronto rimosso](04-removed.jpg)
- [Confronto MSCI World](05-msci-comparison.jpg)
