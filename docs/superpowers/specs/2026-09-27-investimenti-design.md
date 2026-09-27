# Investimenti — portafoglio, prezzi di mercato gratuiti, statistiche

**Data**: 2026-09-27
**Stato**: brainstorming in corso — visione e roadmap concordate con l'utente, design della Fase 1 proposto, **da approvare** prima di scrivere il piano. Prima del piano va fatta la prova di copertura dei dati (sezione 3).
**Schermata**: Investimenti (oggi `comingSoon` in sidebar), sezione 5 di `docs/functional-spec.md`

## Obiettivo

L'utente vuole uno strumento a 360° per gli investimenti: **tracciare il proprio portafoglio giorno per giorno** con statistiche (rendimenti, diversificazione, rischio) e, più avanti, **analizzare singoli strumenti** (azioni, ETF…). Vincolo non negoziabile: **costo zero**. Solo fonti di dati gratuite, niente abbonamenti a provider.

## Contesto dell'utente (dal brainstorming)

- Portafoglio con **un po' di tutto**: ETF, azioni quotate, obbligazioni/titoli di Stato, fondi, crypto. **Nessuna azione non quotata.**
- Broker: **Fineco**, con un **PAC attivo**.
- **Import CSV del broker: rimandato** su scelta dell'utente (sezione "Rimandato consapevolmente").
- **Analisi dei singoli titoli: rimandata**, ma da tenere tracciata (backlog + questa spec).
- **Fiscalità italiana: interessa**, in una fase dedicata. Però il modello dati della Fase 1 salva già i dati che servono.

## Decisioni prese in brainstorming

| Tema | Scelta | Alternative scartate |
|---|---|---|
| Da cosa partire | **Prima il tracciamento del portafoglio**, poi l'analisi dei titoli | Tutto insieme: l'analisi richiede dati ricchi (fondamentali, look-through, screener), che gratis sono deboli e fragili |
| Fonte prezzi | **Yahoo Finance** (`yahoo-finance2`) come fonte principale, dietro un'interfaccia `PriceProvider` sostituibile | API a pagamento (vincolo costo zero); Alpha Vantage free (25 chiamate/giorno, troppo poche) |
| Frequenza prezzi | **Chiusura giornaliera (EOD)** salvata in Postgres, più al massimo una quotazione del giorno in cache Redis | Tempo reale (inutile per un portafoglio di lungo periodo, e fragile gratis) |
| Posizioni | **Calcolate dalle operazioni**, mai salvate | Posizioni salvate e modificate a mano (due fonti di verità, stesso problema già evitato con `effectiveAmount`) |
| Metodo del costo | **Costo medio ponderato** (quello mostrato da Fineco e usato dal fisco italiano nel regime amministrato) | FIFO (non è il metodo fiscale italiano) |

## 1. Roadmap

| Fase | Contenuto | Stato |
|---|---|---|
| **0. Prova dati** | Verificare dalla VPS e in locale che Yahoo risponda e copra gli strumenti reali dell'utente (sezione 3) | **da fare, prima del piano** |
| **1. Portafoglio base** | Strumenti, operazioni manuali, PAC, prezzi EOD + cambi BCE, valore/guadagno/perdita, composizione per tipo e valuta, grafico nel tempo, classe `investimenti` nel patrimonio netto | design qui sotto |
| **2. Rendimenti e confronto** | Rendimento del portafoglio (TWR) e tuo rendimento effettivo (XIRR), confronto "stessi versamenti in un indice", split, storico dividendi/cedole, rendimento reale (inflazione Eurostat) | futuro |
| **3. Rischio e diversificazione** | Volatilità, massima perdita dal picco, Sharpe, beta, correlazioni; settore e geografia (look-through ETF dove i dati gratuiti lo permettono); sovrapposizione tra ETF; allocazione obiettivo e "dove mettere il prossimo PAC" | futuro |
| **4. Fiscalità italiana** | Plus/minusvalenze, zaino delle minusvalenze con scadenza a 4 anni, distinzione redditi diversi / redditi di capitale (le plus degli ETF armonizzati non compensano le minus), stima tasse prima di una vendita, bollo 0,2% | futuro |
| **5. Import CSV Fineco** | Import delle operazioni dall'export Fineco, con mappatura delle colonne riusabile per altri broker | **rimandato** (scelta utente) |
| **6. Analisi titoli** | Pagina strumento (storico, fondamentali da Yahoo), watchlist, avvisi di prezzo (email / notifica PWA), commento opzionale via Ollama. Screener escluso (non realistico gratis) | **rimandato** (scelta utente, tracciato) |

## 2. Fonti di dati gratuite

| Serve per | Fonte | Note e rischi |
|---|---|---|
| Prezzi EOD, storico, ricerca per ISIN/nome, fondamentali (Fase 6), settori ETF (Fase 3) | **Yahoo Finance** via `yahoo-finance2` | Non ufficiale: può rompersi (meccanismo cookie/"crumb") e i termini d'uso ne vietano l'uso non personale. Accettabile per uso personale; se l'app si apre a utenti esterni va rivalutato, e l'interfaccia `PriceProvider` serve a questo |
| Storico di riserva | **Stooq** (CSV senza chiave) | Copertura parziale sugli strumenti europei |
| Crypto | **CoinGecko** (piano gratuito) | Id propri, niente ISIN |
| Cambi | **BCE** (Data API, ufficiale) | Base EUR, un fixing al giorno (no weekend/festivi: si usa l'ultimo disponibile) |
| Inflazione (Fase 2) | **Eurostat HICP** | Serve anche ad Analitiche |
| ISIN → ticker | **OpenFIGI** (gratuito, chiave facoltativa) | Riserva se la ricerca Yahoo per ISIN non trova lo strumento |

**Prezzo manuale sempre disponibile** (decisione già presa in `functional-spec.md`): ogni strumento può avere `priceSource = "manuale"`, e l'utente può inserire un prezzo a mano anche per uno strumento automatico. È la rete di sicurezza per BTP e fondi se la copertura gratuita non basta.

## 3. Fase 0 — prova di copertura (prima del piano)

Da eseguire **dalla VPS di produzione** (IP di datacenter Hostinger, dove Yahoo a volte risponde 429 o blocca) **e** in locale. Dal sandbox cloud non si può: il 2026-09-27 le richieste a Yahoo, Stooq e BCE hanno ricevuto 403 dalla policy di rete dell'ambiente.

Script usa-e-getta, non committato come feature, che per una lista di ISIN reali dell'utente (solo gli identificativi, **nessuna quantità**) verifica:

1. la ricerca per ISIN restituisce un simbolo Yahoo, e su quale borsa (per gli ETF preferire la quotazione in EUR: Xetra `.DE` o Borsa Italiana `.MI`);
2. lo storico giornaliero arriva, fino a quando e in quale valuta;
3. **BTP e obbligazioni**: se c'è copertura (probabilmente scarsa, i prezzi del MOT su Yahoo sono incompleti) e se il prezzo è in percentuale del nominale;
4. **fondi comuni** (non quotati in borsa, NAV giornaliero): se Yahoo li espone (di solito con id Morningstar tipo `0P0000…`);
5. crypto su CoinGecko e cambi BCE;
6. ripetuto per qualche giorno dalla VPS, per vedere se arrivano errori 429 o blocchi.

Esito atteso: una tabella strumento → fonte (`yahoo` / `coingecko` / `manuale`). Se BTP o fondi non sono coperti restano a prezzo manuale in Fase 1, e si valuta una fonte dedicata (es. Borsa Italiana) come lavoro separato.

## 4. Fase 1 — design proposto

### 4.1 Dati

Tutte le nuove tabelle tramite migration Drizzle versionata (`pnpm db:generate` + `db:migrate`, regola del 2026-09-26). Tipi e sorgenti sono `text` + costanti TypeScript, non enum Postgres, così si aggiungono valori senza migrazioni (stesso criterio di `net_worth_snapshots.assetClass`).

**`instruments`**: **comune a tutti gli utenti**, perché i prezzi di VWCE sono gli stessi per tutti.

| Colonna | Note |
|---|---|
| `id` | uuid |
| `isin` | nullable (le crypto non l'hanno), unique quando presente |
| `name` | nome visualizzato |
| `type` | `etf` / `azione` / `obbligazione` / `fondo` / `crypto` / `etc` (materie prime) |
| `currency` | valuta di quotazione (ISO 4217) |
| `priceSource` | `yahoo` / `coingecko` / `manuale` |
| `providerSymbol` | es. `VWCE.DE`, `bitcoin`; nullable per `manuale` |
| `exchange` | facoltativo, informativo |
| `priceUnit` | `unita` (prezzo per quota) o `percentuale_nominale` (obbligazioni: valore = nominale × prezzo / 100) |
| `taxRate` | aliquota italiana: 26% di default, 12,5% per titoli di Stato e assimilati (serve alla Fase 4, salvato subito) |
| `taxHarmonized` | per ETF/fondi: armonizzato UE sì/no (Fase 4) |

Uno strumento `manuale` creato da un utente resta visibile solo a lui (`createdByUserId` nullable): non inquina la ricerca degli altri con nomi o prezzi inventati.

**`instrument_prices`**: `(instrumentId, date)` unique, `close` numeric(20,8), `source`. Una riga al giorno per strumento; i prezzi manuali stanno in una tabella per utente (`user_instrument_prices`), perché un prezzo inserito a mano da un utente non deve cambiare il portafoglio di un altro.

**`fx_rates`**: `(date, currency)` unique, `perEur` (1 EUR = x valuta, come pubblica la BCE). La conversione tra due valute qualsiasi passa dall'EUR: l'app è multi-valuta e la valuta dell'utente non è per forza l'EUR.

**`investment_portfolios`**: per utente (`name`, `broker` facoltativo). Di solito uno ("Fineco"), ma se ne possono avere più di uno.

**`investment_transactions`**: per utente.

| Colonna | Note |
|---|---|
| `type` | `acquisto` / `vendita` / `dividendo` / `cedola` / `rimborso` (scadenza obbligazione). `split` in Fase 2 |
| `date` | data dell'operazione |
| `quantity` | numeric(24,10): frazioni di crypto e quote di fondi; nominale per le obbligazioni |
| `price` | numeric(20,8) nella valuta dello strumento |
| `fxRate` | cambio valuta strumento → valuta utente alla data; default dalla BCE, modificabile (Fineco applica il suo cambio) |
| `fees` | commissioni, nella valuta dell'utente |
| `taxes` | imposte trattenute (plusvalenza, ritenuta su dividendi), per la Fase 4 |
| `grossAmount` | per `dividendo`/`cedola`: importo lordo |
| `note` | facoltativa |

Controllo lato server: una vendita non può superare le quote possedute a quella data (decisione già presa in `functional-spec.md`).

**`investment_plans`** (PAC): `portfolioId`, `instrumentId`, `amount`, `frequency` (mensile / bimestrale / trimestrale), `dayOfMonth`, `active`. In Fase 1 serve a mostrare l'importo del PAC nei KPI e a **precompilare** il form "Registra operazione" (strumento e importo). **Non genera operazioni da solo**: prezzo e quote reali di esecuzione li decide Fineco, e un acquisto inventato renderebbe falsi prezzo medio e guadagno.

**Patrimonio netto**: `ASSET_CLASSES` in `net_worth_snapshots.ts` si allarga a `"investimenti"` (colonna `text`, niente migrazione). Il cron `net-worth-snapshot` (23:50) scrive anche la riga investimenti. Grazie a operazioni + prezzi storici, lo storico passato si ricostruisce come righe `derivato`, stesso meccanismo della liquidità: la Panoramica mostra subito due classi, e si sblocca il donut di allocazione rimandato il 2026-09-13.

### 4.2 Calcoli (funzioni pure, `lib/calc/investments.ts`)

- **Posizioni a una data**: quote, costo medio ponderato (commissioni di acquisto incluse), guadagno realizzato sulle vendite (prezzo di vendita − costo medio, al netto di commissioni), dividendi e cedole incassati.
- **Valore a una data**: quote × ultimo prezzo disponibile ≤ data (automatico o manuale, vince il manuale più recente) × cambio. Il prezzo più recente mostra **sempre la sua data**: un prezzo vecchio di giorni si vede, non si nasconde.
- **Serie del valore nel tempo** e **investito netto nel tempo** (versamenti − rientri), per il grafico. Si calcola su richiesta da operazioni + prezzi, con cache Redis. Niente snapshot per singolo strumento: i dati di partenza sono già deterministici.
- **Composizione** per tipo di strumento e per valuta. Settore e geografia in Fase 3.

### 4.3 Aggiornamento prezzi

- **CronJob k8s `market-prices`** → `GET /api/cron/market-prices` (protetto da `CRON_SECRET`, come gli altri), **ogni giorno alle ~23:00** Europe/Rome (dopo la chiusura USA; anche nel weekend per le crypto). Gira **prima** di `net-worth-snapshot` (23:50).
- Aggiorna solo gli strumenti posseduti da almeno un utente, più i cambi BCE. Richieste in sequenza con piccola pausa, retry con backoff. Se un provider fallisce resta l'ultimo prezzo valido (con la sua data), e il job non si interrompe.
- **Recupero dello storico** quando uno strumento viene usato per la prima volta (o quando si registra un'operazione più vecchia dello storico presente): job in background secondo lo standard "Operazioni lunghe" (`after()` + stato su Redis + indicatore globale). Scarica dalla data della prima operazione.
- **Osservabilità**: `recordCronRun("market_prices", …)`; metrica `buddybudget_price_provider_requests_total{provider, outcome}` (etichette da enum chiuso); log `market.prices.failed` con simbolo e provider. **Mai quantità, importi o composizione del portafoglio di un utente nei log**: il simbolo di uno strumento comune non è un dato personale, il fatto che un certo utente lo possieda sì.

### 4.4 Interfaccia (`/investimenti`)

- **KPI**: valore del portafoglio (con variazione dall'ultima chiusura), guadagno totale (non realizzato + realizzato + dividendi, in € e %), investito netto con importo PAC mensile.
- **Grafico**: valore vs investito nel tempo, periodi 1M/3M/1A/Max (stesso selettore della Panoramica).
- **Posizioni**: strumento, quote, prezzo medio, ultimo prezzo con data, valore, guadagno €/%, peso %. Nome modificabile, ISIN no (decisione in `functional-spec.md`).
- **Composizione**: per tipo di strumento e per valuta.
- **Operazioni**: lista + "Registra operazione" (tipo, strumento cercato per ISIN o nome tramite la ricerca del provider, quote, prezzo, data, commissioni, cambio precompilato, totale calcolato). Stesso schema di dialog del "+ Aggiungi" di Transazioni.
- **PAC**: card con piani attivi, importo mensile e bottone "Registra esecuzione" che precompila il form.
- A implementazione completata: togliere `comingSoon` da `NAV_ITEMS` e la voce da `UPCOMING_FEATURES` (regola "Schermate in arrivo" di CLAUDE.md).

### 4.5 Rapporto con Conti e Transazioni

Un versamento del PAC esce dal conto corrente Fineco (se collegato via GoCardless) e compare in Transazioni come uscita. **In Fase 1 non si collegano i due movimenti**: il movimento bancario va categorizzato in una categoria del gruppo **"Te futuro"** (che per la decisione del 2026-09-23 conta già come spesa prioritaria), mentre l'operazione di investimento vive in Investimenti. Il patrimonio netto resta coerente: la liquidità scende e gli investimenti salgono. Il collegamento automatico movimento ↔ operazione (es. proporre di registrare l'esecuzione del PAC quando arriva il movimento) è un possibile miglioramento successivo.

## Rimandato consapevolmente

- **Import CSV Fineco**: scelta dell'utente il 2026-09-27; Fase 5. Da riprendere quando inserire le operazioni a mano diventa il collo di bottiglia.
- **Analisi dei singoli titoli**: scelta dell'utente il 2026-09-27, da tenere tracciata; Fase 6. Screener escluso anche lì.
- **Split, TWR/XIRR, benchmark**: Fase 2. Uno split in Fase 1 si gestisce a mano (vendita + acquisto equivalenti).
- **Ratei delle obbligazioni** (interessi maturati tra una cedola e l'altra): esclusi dal valore in Fase 1, piccola imprecisione accettata.
- **Tempo reale**: escluso, prezzi di chiusura.
- **Collegamento automatico movimento bancario ↔ operazione**: successivo alla Fase 1.

## Da confermare con l'utente prima del piano

1. Risultati della Fase 0 (copertura di BTP e fondi Fineco).
2. PAC che precompila invece di generare operazioni da solo.
3. Ratei obbligazionari esclusi dalla Fase 1.
