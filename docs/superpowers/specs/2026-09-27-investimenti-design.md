# Investimenti — portafoglio, prezzi di mercato gratuiti, statistiche

**Data**: 2026-09-27
**Stato**: design approvato dall'utente il 2026-09-27 ("procediamo"), piano della Fase 1 scritto: `docs/superpowers/plans/2026-09-27-investimenti-fase-1.md`. La prova di copertura (sezione 3) è diventata il primo task del piano e non blocca il resto: l'ordine delle fonti è configurabile.
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
| Fonte prezzi | **Catena di fonti gratuite con riserva automatica** per tipo di strumento (sezione 2.1), Yahoo Finance in testa quasi ovunque | API a pagamento (vincolo costo zero); una sola fonte (un blocco di Yahoo fermerebbe tutto) |
| Frequenza prezzi | **Chiusura giornaliera (EOD)** salvata in Postgres, più al massimo una quotazione del giorno in cache Redis | Tempo reale (inutile per un portafoglio di lungo periodo, e fragile gratis) |
| Posizioni | **Calcolate dalle operazioni**, mai salvate | Posizioni salvate e modificate a mano (due fonti di verità, stesso problema già evitato con `effectiveAmount`) |
| Metodo del costo | **Costo medio ponderato** (quello mostrato da Fineco e usato dal fisco italiano nel regime amministrato) | FIFO (non è il metodo fiscale italiano) |

## 1. Roadmap

| Fase | Contenuto | Stato |
|---|---|---|
| **0. Prova dati** | Verificare dalla VPS e in locale quali fonti rispondono e cosa coprono, su un campione di strumenti pubblici (sezione 3) | primo task del piano Fase 1 |
| **1. Portafoglio base** | Strumenti, operazioni manuali, PAC, prezzi EOD + cambi BCE, valore/guadagno/perdita, composizione per tipo e valuta, grafico nel tempo, classe `investimenti` nel patrimonio netto | design qui sotto |
| **2. Rendimenti e confronto** | Rendimento del portafoglio (TWR) e tuo rendimento effettivo (XIRR), confronto "stessi versamenti in un indice", split, storico dividendi/cedole, rendimento reale (inflazione Eurostat) | **implementata** il 2026-09-29, spec `2026-09-29-investimenti-fase-2-design.md` |
| **3. Rischio e diversificazione** | Volatilità, massima perdita dal picco, Sharpe, beta, correlazioni; settore e geografia (look-through ETF dove i dati gratuiti lo permettono); sovrapposizione tra ETF; allocazione obiettivo e "dove mettere il prossimo PAC" | futuro |
| **4. Fiscalità italiana** | Plus/minusvalenze, zaino delle minusvalenze con scadenza a 4 anni, distinzione redditi diversi / redditi di capitale (le plus degli ETF armonizzati non compensano le minus), stima tasse prima di una vendita, bollo 0,2% | futuro |
| **5. Import CSV Fineco** | Import delle operazioni dall'export Fineco, con mappatura delle colonne riusabile per altri broker | **implementata** il 2026-09-29 (import CSV generico con formati riconosciuti) |
| **6. Analisi titoli** | Pagina strumento (storico, fondamentali da Yahoo), watchlist, avvisi di prezzo (email / notifica PWA), commento opzionale via Ollama. Screener escluso (non realistico gratis) | **rimandato** (scelta utente, tracciato) |

## 2. Fonti di dati gratuite

| Serve per | Fonte | Note e rischi |
|---|---|---|
| Prezzi EOD, storico, ricerca per ISIN/nome, fondamentali (Fase 6), settori ETF (Fase 3) | **Yahoo Finance** via `yahoo-finance2` | Non ufficiale: può rompersi (meccanismo cookie/"crumb") e i termini d'uso ne vietano l'uso non personale. Accettabile per uso personale; se l'app si apre a utenti esterni va rivalutato, e l'interfaccia `PriceProvider` serve a questo |
| Tutto ciò che è quotato a Milano (MOT/BTP, ETFplus, azioni) | **Borsa Italiana**, endpoint JSON non documentato dei grafici (`grafici.borsaitaliana.it`, lo usa la libreria LGPL `Librefolio/borsaItaliana-scraping`) | Unica fonte gratuita buona per i BTP. Protetto da WAF Imperva con token anonimo: fragile, può bloccare IP di datacenter, zona grigia sui termini. Solo uso personale |
| Riserva ETF/azioni EU | **Stooq** (CSV EOD) | Dal 2026 richiede una `apikey` ottenuta una volta con captcha. Copertura parziale sugli strumenti europei |
| Riserva ETF/azioni EU con chiave | **Alpha Vantage** (25 chiamate/giorno) | Borse globali incluse; il limite basta per l'aggiornamento giornaliero di ~20 strumenti, non per il recupero dello storico |
| Riserva azioni USA | **Twelve Data** (800/giorno), **Finnhub** (60/min, storico 1 anno), **Tiingo** | Piani gratuiti ufficiali ma **solo USA**: utili soltanto per le azioni americane |
| Fondi comuni (NAV) | Nessuna API gratuita ufficiale | Yahoo con id Morningstar `0P…` se c'è, altrimenti prezzo manuale. Gli endpoint non documentati di Morningstar sono troppo fragili per dipenderne |
| Crypto | **CoinGecko** (piano gratuito); riserva: API pubbliche di **Binance/Kraken** (senza chiave) | Id propri, niente ISIN |
| Cambi | **BCE** (Data API, ufficiale) | Base EUR, un fixing al giorno (no weekend/festivi: si usa l'ultimo disponibile) |
| Inflazione (Fase 2) | **Eurostat HICP** | Serve anche ad Analitiche |
| ISIN → ticker | **OpenFIGI** (gratuito, chiave facoltativa) | Riserva se la ricerca Yahoo per ISIN non trova lo strumento |

**Prezzo manuale sempre disponibile** (decisione già presa in `functional-spec.md`): ogni strumento può avere `priceSource = "manuale"`, e l'utente può inserire un prezzo a mano anche per uno strumento automatico. È la rete di sicurezza per BTP e fondi se la copertura gratuita non basta.

### 2.1 Catena di fonti con riserva automatica

Richiesta esplicita dell'utente (2026-09-27): nessuna fonte gratuita è affidabile da sola, quindi ogni prezzo si chiede a **più fonti in ordine**, e se la prima fallisce si passa alla successiva senza intervento dell'utente.

**Interfaccia comune** (`lib/market-data/`): ogni fonte implementa `PriceProvider` con `id`, `requiresKey`, `fetchDailyCloses(symbol, from, to)` (chiusure giornaliere con valuta) e, dove esiste, `searchByIsin(isin)`. I cambi hanno un'interfaccia separata `FxProvider`.

**Ordine predefinito per tipo di strumento** (costante `PROVIDER_CHAINS`, modificabile in un solo punto dopo la prova di copertura):

| Tipo | Catena |
|---|---|
| ETF / ETC / azioni europee | Yahoo → Borsa Italiana (solo se quotato a Milano) → Stooq → Alpha Vantage |
| Azioni USA | Yahoo → Stooq → Twelve Data → Alpha Vantage |
| Obbligazioni / BTP | Borsa Italiana → Yahoo |
| Fondi comuni | Yahoo (id `0P…`) → nessuna riserva: prezzo manuale |
| Crypto | CoinGecko → Kraken |
| Cambi | BCE → Frankfurter (stessi dati BCE, altra via d'accesso) |

**Simboli per fonte**: ogni fonte usa un suo simbolo (`VWCE.DE` su Yahoo, `vwce.de` su Stooq, `VWCE.DEX` su Alpha Vantage, id numerico su Borsa Italiana). Per questo i simboli stanno in una tabella `instrument_symbols (instrumentId, provider, symbol)` e non in una colonna unica. Si risolvono alla creazione dello strumento (ricerca per ISIN su ogni fonte che la supporta, altrimenti derivazione dal simbolo Yahoo e borsa); una fonte senza simbolo per quello strumento viene saltata. La risoluzione si ritenta nei giorni successivi per le fonti rimaste senza simbolo.

**Regole della catena**:
1. Si provano le fonti in ordine; vince la **prima risposta valida**. Valida significa: almeno una chiusura nel periodo chiesto, prezzo > 0, **valuta uguale a quella dello strumento**. Una quotazione in un'altra valuta (es. la stessa azione quotata in USD) viene scartata: mescolare valute falserebbe il valore.
2. Ogni riga di `instrument_prices` salva la **fonte che l'ha fornita** (`source`). Così si vede quanto spesso si finisce sulle riserve.
3. **Fonte senza chiave = disattivata, non in errore.** Stooq, Alpha Vantage, Twelve Data e CoinGecko leggono chiavi facoltative da variabili d'ambiente; se manca, la fonte si salta in silenzio (stesso principio di Ollama: "non configurato" è uno stato normale).
4. **Interruttore per fonte** (circuit breaker): dentro un'esecuzione del cron, dopo 3 errori consecutivi della stessa fonte (429, 5xx, blocco del firewall, timeout) quella fonte si salta per il resto dell'esecuzione. Evita di martellare una fonte che ci ha bloccato.
5. **Budget per le fonti a quota**: Alpha Vantage (25/giorno) ha un contatore giornaliero su Redis; esaurito il budget, la fonte si salta fino al giorno dopo. Pausa minima tra richieste configurata per fonte.
6. **Recupero dello storico** solo dalle fonti senza limite di profondità (Yahoo, Borsa Italiana, Stooq); le fonti a quota servono solo all'aggiornamento giornaliero.
7. **Controllo di plausibilità**: se la nuova chiusura si scosta di oltre il 20% dalla precedente **e** arriva da una fonte diversa, si salva comunque ma si logga `market.prices.suspect` (le crypto sono escluse dalla soglia). In Fase 1 niente blocco automatico: solo visibilità.
8. Se **tutte** le fonti falliscono resta l'ultimo prezzo valido, mostrato con la sua data. Il prezzo manuale dell'utente, se più recente, vince sempre.

**Osservabilità**: metrica `buddybudget_price_provider_requests_total{provider, outcome}` con `outcome` da enum chiuso (`success`, `empty`, `currency_mismatch`, `error`, `rate_limited`, `skipped`); log `market.prices.fallback_used` quando serve una riserva. Un alert su "troppe riserve" o "prezzi fermi" si aggiunge dopo aver visto i numeri reali.

## 3. Fase 0 — prova di copertura (primo task del piano)

Da eseguire **dalla VPS di produzione** (IP di datacenter Hostinger, dove Yahoo a volte risponde 429 o blocca) **e** in locale. Dal sandbox cloud non si può: il 2026-09-27 le richieste a Yahoo, Stooq e BCE hanno ricevuto 403 dalla policy di rete dell'ambiente.

L'utente ha scelto di non fornire i propri ISIN (2026-09-27). Lo script di prova usa un **campione di strumenti pubblici** per ogni tipo (ETF UCITS su Xetra e Milano, azione italiana, azione USA, un BTP, un fondo comune, una crypto) e verifica:

1. la ricerca per ISIN restituisce un simbolo Yahoo, e su quale borsa (per gli ETF preferire la quotazione in EUR: Xetra `.DE` o Borsa Italiana `.MI`);
2. lo storico giornaliero arriva, fino a quando e in quale valuta;
3. **BTP e obbligazioni**: copertura su Yahoo (probabilmente scarsa) e sull'endpoint di Borsa Italiana (probabilmente buona), prezzo in percentuale del nominale;
4. **fondi comuni** (non quotati in borsa, NAV giornaliero): se Yahoo li espone (di solito con id Morningstar tipo `0P0000…`);
5. **Borsa Italiana dalla VPS**: se il WAF Imperva lascia passare le richieste dall'IP del datacenter;
6. crypto su CoinGecko e cambi BCE;
7. ripetuto per qualche giorno dalla VPS, per vedere se arrivano errori 429 o blocchi.

Esito: una tabella tipo di strumento → fonti che funzionano, usata per confermare o riordinare `PROVIDER_CHAINS`, più le risposte reali salvate come fixture per i test dei parser (dal sandbox cloud le fonti non si raggiungono). Se Borsa Italiana è bloccata dalla VPS, il suo provider si implementa comunque ma resta in fondo alle catene, e i BTP ricadono sul prezzo manuale.

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
| `priceMode` | `auto` (catena di fonti) o `manuale` (solo prezzi inseriti dall'utente) |
| `exchange` | facoltativo, informativo |
| `priceUnit` | `unita` (prezzo per quota) o `percentuale_nominale` (obbligazioni: valore = nominale × prezzo / 100) |
| `taxRate` | aliquota italiana: 26% di default, 12,5% per titoli di Stato e assimilati (serve alla Fase 4, salvato subito) |
| `taxHarmonized` | per ETF/fondi: armonizzato UE sì/no (Fase 4) |

Uno strumento `manuale` creato da un utente resta visibile solo a lui (`createdByUserId` nullable): non inquina la ricerca degli altri con nomi o prezzi inventati.

**`instrument_symbols`**: `(instrumentId, provider)` unique, `symbol`, `resolvedAt`. Vedi sezione 2.1.

**`instrument_prices`**: `(instrumentId, date)` unique, `close` numeric(20,8), `source` (la fonte che ha fornito il prezzo). Una riga al giorno per strumento; i prezzi manuali stanno in una tabella per utente (`user_instrument_prices`), perché un prezzo inserito a mano da un utente non deve cambiare il portafoglio di un altro.

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
- Aggiorna solo gli strumenti posseduti da almeno un utente, più i cambi. Ogni strumento passa dalla catena di fonti della sezione 2.1; un errore su uno strumento non interrompe gli altri.
- **Recupero dello storico** quando uno strumento viene usato per la prima volta (o quando si registra un'operazione più vecchia dello storico presente): job in background secondo lo standard "Operazioni lunghe" (`after()` + stato su Redis + indicatore globale). Scarica dalla data della prima operazione.
- **Osservabilità**: `recordCronRun("market_prices", …)` più quanto descritto nella sezione 2.1. **Mai quantità, importi o composizione del portafoglio di un utente nei log**: il simbolo di uno strumento comune non è un dato personale, il fatto che un certo utente lo possieda sì.

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

## Default adottati

L'utente ha chiesto di procedere il 2026-09-27 senza rispondere punto per punto, quindi valgono le proposte della spec:

1. Fase 0 su un campione di strumenti pubblici, non sugli ISIN dell'utente.
2. Il PAC precompila il form, non genera operazioni da solo.
3. Ratei obbligazionari esclusi dalla Fase 1.
