# Investimenti, Fase 3: rischio e diversificazione

**Data**: 2026-09-29
**Stato**: implementata il 2026-09-29 nella stessa sessione del design, su richiesta dell'utente ("andiamo alla fase 3 della sezione investimenti"), branch `claude/serene-goldberg-r8qw3k`. Non ancora mergiata.
**Spec madre**: `2026-09-27-investimenti-design.md`, sezione 1 (roadmap): "Volatilità, massima perdita dal picco, Sharpe, beta, correlazioni; settore e geografia (look-through ETF dove i dati gratuiti lo permettono); sovrapposizione tra ETF; allocazione obiettivo e 'dove mettere il prossimo PAC'".

## Scelte dell'utente (2026-09-29)

| Domanda | Scelta |
|---|---|
| Tutta la fase o a pezzi | **Tutta insieme**, come la Fase 2 |
| Da dove prendere settore e area degli ETF | **Yahoo + correzione manuale** per strumento |
| Su cosa si definisce l'allocazione obiettivo | **Per strumento** (es. VWCE 70%, BTP 20%, BTC 10%) |
| Tasso privo di rischio per lo Sharpe | **€STR dalla BCE**, aggiornato dal cron |

## 1. Rischio (card "Quanto rischia")

Sullo stesso periodo della card principale (1M/3M/1A/Max), come i rendimenti della Fase 2. Logica pura in `lib/calc/risk.ts`.

**Rendimenti giornalieri usati**: quelli del TWR della Fase 2 (`computeDailyReturns`), senza i giorni con niente investito e senza **sabato e domenica quando il rendimento è esattamente zero** (mercati chiusi: contarli abbasserebbe la volatilità). Con le crypto il weekend si muove e resta. Gli anni si contano dai dati: osservazioni per anno = `n × 365 / giorni di calendario coperti` (circa 252 con ETF, 365 con sole crypto), così non serve sapere quali borse ci sono.

- **Volatilità annua**: deviazione standard campionaria dei rendimenti giornalieri × √(osservazioni per anno). Frase: "In un anno normale può muoversi di circa ±X% (due anni su tre)". Accanto, quella dell'indice di confronto se scelto ("più/meno movimentato di …").
- **Massima perdita dal picco**: sull'indice del TWR (non sul valore, che salirebbe con i versamenti). Picco, minimo, recupero (primo giorno di nuovo al picco) o "non ancora recuperata", e perdita attuale dal picco. Grafico "sott'acqua" (area della perdita dal picco nel tempo); su 1A/Max un punto per mese col minimo del mese, per non nascondere il fondo.
- **Sharpe**: `(media giornaliera − €STR medio / osservazioni per anno) / dev. standard × √(osservazioni per anno)`. €STR medio sui giorni osservati (ultimo valore disponibile a ogni data). Solo per valuta EUR: per le altre valute si usa zero e si dice. Se la tabella €STR è vuota (es. prima del primo giro del cron) si usa zero e si dice. Lettura: < 0 "hai reso meno di un conto deposito", < 0,5 "poco premiato per il rischio", < 1 "discreto", ≥ 1 "buono".
- **Beta e correlazione con l'indice di confronto** (solo con benchmark scelto nella card dei rendimenti): rendimenti giornalieri dell'indice in valuta utente negli stessi giorni. Beta = cov / var dell'indice. Frase: "Quando l'indice si muove dell'1%, il portafoglio tende a muoversi dello X%".
- **Minimi**: volatilità e perdita dal picco da 20 osservazioni; Sharpe, beta e correlazioni da 60. Sotto 250 osservazioni (circa un anno di borsa) la card avverte "meno di un anno di dati: numeri indicativi".

**Limite noto**: prezzi di chiusura di borse con orari diversi (USA dopo l'Europa) abbassano un po' le correlazioni giornaliere. Accettato.

## 2. Diversificazione: settore e area geografica (look-through)

### Dati

Per ogni strumento, per ciascuna dimensione (settore, area), si sceglie **una** fonte in quest'ordine:

1. **Manuale dell'utente** (per utente, per strumento, per dimensione): vince sempre. La parte non assegnata finisce in "Non classificato".
2. **Dal tipo**: crypto → settore "Crypto", area "Senza area"; ETC → settore "Materie prime", area "Senza area"; obbligazione → settore "Obbligazioni", area dal paese dell'ISIN.
3. **Yahoo** (`quoteSummary`, moduli `topHoldings` e `assetProfile`): per ETF e fondi i pesi per settore (`sectorWeightings`, solo la parte azionaria) scalati sulla quota azionaria (`stockPosition`), il resto in "Obbligazioni" / "Liquidità" / "Altro"; per le azioni settore e paese dell'azienda. Yahoo **non dà la ripartizione per area degli ETF**.
4. **Stima dall'indice** (aggiunta a quanto scelto dall'utente, perché Yahoo non ha le aree degli ETF): una tabella di pochi indici molto diffusi (FTSE All-World / MSCI ACWI, MSCI World, S&P 500 / MSCI USA, Nasdaq-100, MSCI Emerging Markets, Europa, Giappone, FTSE MIB) riconosciuti dal nome dello strumento, con aree e settori approssimati al 2025-2026. Gli ETF settoriali/tematici (nome con "Information Technology", "Health Care", "Clean Energy"…) non si riconoscono; quelli "fattoriali" (small cap, value, momentum, dividendi…) prendono solo le aree. Si dice sempre "stima dall'indice".
5. Azioni senza dati Yahoo: area dal paese dell'ISIN (per gli ETF l'ISIN dice solo dove è domiciliato il fondo, IE/LU, quindi non si usa).
6. Altrimenti "Non classificato".

**Chiavi chiuse** (per sommare fonti diverse): settori `tecnologia, finanza, salute, industria, consumi_ciclici, consumi_difensivi, comunicazioni, energia, materiali, servizi_pubblici, immobiliare` + `obbligazioni, liquidita, materie_prime, crypto, altro, non_classificato`. Aree `nord_america, europa, italia, giappone, pacifico, emergenti, nessuna, non_classificato`. L'Italia è separata dall'Europa (BTP e azioni italiane sono tipici di un portafoglio italiano); nelle stime dall'indice l'Italia resta dentro "Europa" (pesa meno dell'1% negli indici globali).

**Tabelle** (migration `0004_investimenti_fase_3`):
- `instrument_profiles` (una riga per strumento, comune a tutti gli utenti): simbolo Yahoo usato, `fetched_at`, `sectors`/`asset_mix`/`holdings` (jsonb), `sector`/`country` dell'azienda. Una risposta vuota salva comunque la riga (così non si richiede ogni giorno).
- `user_instrument_breakdowns` (utente, strumento): `sectors` e `areas` jsonb, null = usa l'automatico.

**Aggiornamento**: il cron `market-prices` aggiorna i profili degli strumenti posseduti di tipo ETF/fondo/azione/ETC più vecchi di 30 giorni o mai scaricati, al massimo 20 per giro (per non consumare Yahoo). Quando la pagina carica i dati e uno strumento posseduto non ha ancora un profilo, lo scarica subito in `after()` (al massimo 5 per volta, un tentativo per strumento all'ora con chiave Redis). Errori solo loggati (`market.profiles.failed`), mai propagati.

### Interfaccia

Card "Diversificazione": due barre (Per settore, Per area) con la stessa grafica della composizione, una frase per ciascuna (settore prevalente; quota fuori dall'area principale, quota in Italia), la **copertura** ("il 12% del valore non è classificato") e l'elenco degli strumenti con la fonte usata ("Yahoo", "Stima dall'indice", "Manuale", "Nessun dato") e il bottone "Correggi" che apre un dialog con le percentuali per area e per settore (somma ≤ 100%, il resto è "Non classificato"; "Torna all'automatico" cancella la correzione).

## 3. Sovrapposizioni e correlazioni

Card "Sovrapposizioni", logica pura in `lib/investments/overlap.ts` e `lib/calc/risk.ts`.

- **ETF che si sovrappongono** (coppie di ETF/fondi posseduti):
  - stesso indice stimato → "replicano lo stesso indice" (sovrapposizione 100%);
  - due indici "ampi" diversi della tabella (es. MSCI World e FTSE All-World) → `Σ min(peso area A, peso area B)` (World/All-World ≈ 88%): assume che dentro un'area due indici ampi possiedano le stesse aziende, vero in prima approssimazione per indici a capitalizzazione. Nasdaq-100 non è "ampio";
  - altrimenti, con i **primi 10 titoli** di Yahoo di entrambi → `Σ min(peso)` sui titoli in comune, presentato come "almeno X% in comune tra i primi 10 titoli".
  - Si mostrano le coppie sopra il 20%.
- **Azioni che hai anche dentro un ETF**: se un'azione posseduta compare tra i primi 10 titoli di un ETF posseduto, "Apple pesa il 4,6% in VWCE: in tutto ci hai X €" (valore diretto + valore dell'ETF × peso).
- **Correlazioni**: matrice tra le prime 8 posizioni per valore, sui rendimenti di prezzo in valuta utente calcolati solo nei giorni in cui **entrambi** gli strumenti hanno una chiusura (rendimenti sugli stessi intervalli, niente prezzi "vecchi"); almeno 20 giorni in comune, altrimenti la casella è vuota. Frase: la coppia più correlata (≥ 0,8: "si muovono quasi insieme") e la correlazione media.

## 4. Allocazione obiettivo e prossimo versamento

- Nuova tabella `investment_targets (portfolio_id, instrument_id, weight)`, unica per coppia. Obiettivo **per strumento**, anche per strumenti non ancora posseduti (per pianificare un ETF nuovo). `PUT /api/investments/targets { targets: [{ instrumentId, weight }] }` sostituisce tutto in una transazione; lista vuota = nessun obiettivo. Validazione: pesi tra 0 e 1, somma 100% (tolleranza 0,01%), strumenti visibili all'utente, al massimo 30.
- **Confronto**: per ogni strumento peso attuale, obiettivo, scostamento; "in linea" entro ±5 punti (`ALLOCATION_TOLERANCE`). Gli strumenti posseduti fuori obiettivo compaiono con obiettivo 0. Gli strumenti senza prezzo sono esclusi dal calcolo e segnalati.
- **Prossimo versamento** (importo modificabile, di default il totale mensile dei PAC attivi o 100): solo acquisti, niente vendite. Si "riempie" per primo lo strumento più sotto obiettivo in proporzione al suo peso, fino a portare tutti allo stesso livello (water-filling): trova `λ` tale che `Σ max(0, w_i·λ − valore_i) = importo`. Gli acquisti sotto il 10% dell'importo si scartano e si ridistribuiscono (evita ordini da pochi euro con commissioni fisse). Per ciascuno: importo, peso dopo l'acquisto, bottone "Registra" che precompila il form con quote stimate dall'ultimo prezzo.
- Dialog "Obiettivo": parte dai pesi attuali (arrotondati), righe con percentuale, "Aggiungi strumento" con il selettore esistente, somma in fondo che deve fare 100%, "Distribuisci il resto" sull'ultima riga.

## 5. Tasso privo di rischio (€STR)

- Fonte BCE Data API, serie `EST/B.EU000A2X2A25.WT` (tasso €STR giornaliero, in %), CSV. Nuova tabella `interest_rates (series, date, rate, source)`, `rate` come frazione (0,0192 = 1,92%).
- Cron `market-prices`: ultimi 30 giorni, oppure dall'inizio della serie (ottobre 2019) se la tabella è vuota. Un errore non fa fallire il cron (`market.rates.failed`). Fonte finta al 2% con `MARKET_DATA_FAKE=1`.
- Prima di ottobre 2019 non ci sono dati: la media si fa sui giorni disponibili.

## Dove sta il codice

- `lib/calc/risk.ts`: rendimenti per il rischio, volatilità, perdita dal picco, Sharpe, beta, correlazioni.
- `lib/investments/exposure-keys.ts` (chiavi, etichette, paesi → aree), `index-profiles.ts`, `exposure.ts` (fonte per strumento e aggregazione), `overlap.ts`, `allocation.ts`, `risk-insights.ts`.
- `lib/market-data/providers/yahoo.ts` (`fetchYahooProfile`), `providers/estr.ts`, `profiles.ts`, `rates.ts`.
- API: `PUT /api/investments/targets`, `PUT /api/instruments/[id]/breakdown`; `GET /api/investments/overview` restituisce anche obiettivi, profili, correzioni e €STR.
- UI: `components/domain/investments/risk/`, `diversification/`, `allocation/`.

## Corretto guardando la pagina dal vivo

- Un'azione presente in più ETF compariva una volta per ETF, ciascuna con un "in tutto" parziale: ora una riga per azione con l'esposizione complessiva e l'elenco degli ETF.
- Nel dialog di correzione il "Salva" restava disabilitato se la dimensione **non toccata** superava 100% per gli arrotondamenti a un decimale dei valori automatici: ora si controllano solo le dimensioni modificate, e un totale appena sopra 100 si riporta a 100.
- Volatilità scritta ±4,6% nel riquadro e "±5%" nella frase: ora un decimale ovunque.

## Rimandato consapevolmente

- Ripartizione per area degli ETF da fonti ufficiali degli emittenti (file delle posizioni complete iShares/Vanguard: formati diversi per emittente, fragili).
- Sovrapposizione esatta sulle posizioni complete (servirebbero le stesse fonti).
- Obiettivo per classe di asset (azionario/obbligazionario) e ribilanciamento con vendite (anche per le tasse: Fase 4).
- Tasso privo di rischio per valute diverse da EUR.
- Altri indicatori (Sortino, VaR, tracking error).

## Da verificare dopo il merge (non verificabile dal sandbox)

- La migration la applica il Job PreSync.
- `quoteSummary` di Yahoo risponde dalla VPS e per quali ETF UCITS dà i settori (dal sandbox Yahoo è bloccato).
- La BCE restituisce la serie €STR (dopo il primo giro del cron la tabella `interest_rates` ha righe).
