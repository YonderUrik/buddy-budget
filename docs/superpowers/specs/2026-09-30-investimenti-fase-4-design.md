# Investimenti, Fase 4: fiscalità italiana e sezione Proventi

**Data**: 2026-09-30
**Stato**: implementata il 2026-09-30 nella stessa sessione del design, branch `claude/fase-4-investimenti-dividenti-c1m3cg`. Non ancora mergiata.
**Spec madre**: `2026-09-27-investimenti-design.md`, sezione 1 (roadmap): "Plus/minusvalenze, zaino delle minusvalenze con scadenza a 4 anni, distinzione redditi diversi / redditi di capitale (le plus degli ETF armonizzati non compensano le minus), stima tasse prima di una vendita, bollo 0,2%".

Richiesta dell'utente: "Procediamo con la fase 4 degli investimenti. Inoltre sto notando che non abbiamo una parte dedicata a dividendi e simili" (oggi c'è solo la card "Dividendi e cedole" della Fase 2, in fondo a una pagina di 11 card).

**Avvertenza di prodotto**: sono stime per capire i numeri, non un calcolo fiscale certificato. La UI lo dice nella scheda Tasse.

## Scelte dell'utente (2026-09-30)

| Domanda | Scelta |
|---|---|
| Dove mettere proventi e tasse | **Schede in Investimenti**; poi, su richiesta dell'utente a metà lavoro ("teniamo la sezione investimenti più pulita e semplice possibile"), anche il resto della pagina diviso in schede tematiche |
| Cosa nella parte proventi | **Tutto**: previsione 12 mesi, dividendi non registrati, incassi mese per mese lordo/netto con rendimento e crescita del dividendo |
| Regime fiscale | **Scelto per portafoglio** (amministrato / dichiarativo), default amministrato |

## 1. Struttura a schede

La pagina Investimenti aveva 11 card una sotto l'altra. Ora sei schede con URL propri, la prima con solo l'essenziale:

| Scheda | Route | Contenuto |
|---|---|---|
| Portafoglio | `/investimenti` | valore e guadagno (card principale col grafico), posizioni, PAC |
| Performance | `/investimenti/performance` | selettore del periodo, "Quanto sta rendendo" (con confronto), "Quanto rischia", heatmap "Rendimento nel tempo" |
| Diversificazione | `/investimenti/diversificazione` | composizione per tipo e valuta, settori e aree, sovrapposizioni, allocazione obiettivo |
| Proventi | `/investimenti/proventi` | dividendi e cedole (sezione 4) |
| Tasse | `/investimenti/tasse` | fiscalità (sezione 3) |
| Operazioni | `/investimenti/operazioni` | elenco delle operazioni per mese |

- `app/(app)/investimenti/layout.tsx` (client): titolo, bottoni Importa/Registra, barra delle schede (`InvestmentsTabs`: link veri, `aria-current`, scorrevole su mobile con la scheda attiva portata in vista, con una piccola icona lucide da 14px per scheda: Wallet, TrendingUp, ChartPie, HandCoins, Landmark, ArrowLeftRight; colore del primario sulla scheda attiva, attenuato sulle altre), dialog "Registra operazione" e import condivisi. Le pagine aprono il dialog precompilato con `useInvestmentsActions()` / `useRegisterFromPlan()` (`components/domain/investments/investments-actions.tsx`).
- Tutte le schede usano la stessa query dell'overview (`useInvestmentsView`, `lib/queries/investments-view.ts`) al periodo di default (`3mesi`): cambiare scheda non riscarica niente. Performance ha il suo selettore del periodo; la heatmap e Tasse usano `max` (Tasse serve il valore a fine anno per il bollo).
- Stati comuni (caricamento, errore, portafoglio vuoto) in `InvestmentsViewGate`.
- La card "Dividendi e cedole" passa da Portafoglio a Proventi.

## 2. Dati nuovi (migration `0005_investimenti_fase_4`)

| Tabella / colonna | Cosa |
|---|---|
| `investment_portfolios.tax_regime` | `amministrato` (default) / `dichiarativo` |
| `user_instrument_settings` (utente, strumento) | `tax_rate` (0,26 / 0,125, null = automatico), `tax_harmonized` (null = automatico), per le obbligazioni `coupon_rate` (tasso annuo lordo), `coupon_frequency` (1/2/4), `maturity_date`. Per utente perché gli strumenti sono condivisi: un dato inserito da uno non cambia i conti di un altro |
| `investment_tax_carryforwards` | minusvalenze pregresse inserite a mano (anno di origine, importo, nota): lo zaino di Fineco da prima che l'utente usasse l'app |
| `instrument_dividends` (strumento, data di stacco) | dividendo per quota nella valuta dello strumento, dalla fonte; comune a tutti |
| `instruments.dividends_fetched_at` | ultimo scaricamento dello storico dividendi |
| `user_dismissed_dividends` (utente, strumento, data) | proposte "da registrare" ignorate |

**Aliquota automatica**: la correzione dell'utente, altrimenti 12,5% per le obbligazioni il cui nome indica un titolo di Stato (BTP, BOT, CCT, CTZ, Bund, OAT, Bonos, Treasury…), altrimenti l'aliquota salvata sullo strumento (26% di default: la UI di creazione non l'ha mai chiesta). **Armonizzato automatico**: la correzione, altrimenti il valore dello strumento, altrimenti sì (un ETF quotato in Europa è quasi sempre UCITS).

## 3. Motore fiscale (`lib/calc/taxes.ts`, funzioni pure)

Ogni vendita o rimborso produce una plus/minusvalenza col **costo medio ponderato** (commissioni di acquisto incluse, di vendita dedotte, imposte trattenute escluse), convertita alla valuta utente coi cambi delle operazioni (la componente valutaria fa parte della plusvalenza, come per il fisco).

**Classificazione**:

| Strumento | Guadagno | Perdita |
|---|---|---|
| Azioni, obbligazioni, ETC | reddito diverso (compensabile) | minusvalenza nello zaino |
| ETF, fondi | **reddito di capitale**: tassato per intero, non compensa lo zaino | minusvalenza nello zaino |
| Crypto | categoria a parte: sempre in dichiarazione, compensa solo con crypto | zaino crypto |

**Aliquote**: 26%, 12,5% per i titoli di Stato. Per compensare tra aliquote diverse tutto si porta a "base al 26%": una plus o minus al 12,5% vale il 48,08% (12,5/26). Crypto: 26% fino al 2025, **33% dal 2026** (Legge di Bilancio 2025); franchigia di 2.000 € di plusvalenze nette annue fino al 2024. ETF non armonizzati: in realtà tassati a IRPEF ordinaria in dichiarazione; qui stimati al 26% con avviso.

**Zaino**: una minusvalenza dell'anno Y si usa fino al 31/12 di Y+4, le più vecchie per prime.

- **Amministrato** (il broker fa da sostituto d'imposta): le operazioni si scorrono in ordine di data; una plus usa lo zaino disponibile in quel momento e il resto si tassa subito; una minus entra nello zaino e compensa solo plus **successive**. Le crypto seguono comunque le regole del dichiarativo (il broker non le gestisce).
- **Dichiarativo**: per ogni anno si sommano plus e minus (in base al 26%); se il netto è positivo si usa lo zaino degli anni precedenti, se negativo diventa zaino dell'anno.

**Minusvalenze pregresse** (inserite a mano): entrano nello zaino con il loro anno; in amministrato disponibili dal 1° gennaio di quell'anno, in dichiarativo dagli anni successivi.

**Per anno**: plusvalenze, minusvalenze, redditi di capitale da ETF, zaino usato / generato / scaduto, imposte stimate, imposte trattenute registrate sulle vendite, dividendi e cedole (lordo e ritenute registrate), bollo.

**Bollo**: 0,2% del valore del portafoglio (crypto comprese: per loro vale l'imposta equivalente, in dichiarazione) al 31/12 di ogni anno, in proporzione ai giorni di possesso nel primo anno; per l'anno in corso "se il valore restasse questo" (0,2% del valore di oggi, proporzionato ai giorni di quest'anno in cui c'era qualcosa).

**Prima di vendere** (simulatore): si aggiunge al calcolo una vendita ipotetica di oggi (quote scelte, ultimo prezzo) e si confrontano le imposte e lo zaino dell'anno con e senza: così vale per entrambi i regimi con le stesse regole.

**Opportunità**: zaino in scadenza a fine anno e guadagni non realizzati compensabili (azioni, obbligazioni, ETC, non ETF); posizioni in perdita la cui vendita metterebbe minusvalenze nello zaino.

## 4. Proventi

### Storico dividendi per quota (fonte)

Yahoo `chart` con `events=div` (intervallo mensile, 10 anni): date di stacco e importo per quota, già corretto per gli split (quindi espresso nelle quote di oggi). Solo azioni, ETF, fondi con simbolo Yahoo. Il cron `market-prices` aggiorna gli storici più vecchi di 7 giorni (massimo 20 per giro); la pagina scarica in `after()` quelli mai scaricati (massimo 5, un tentativo all'ora per strumento). Mai un errore propagato. Fonte finta per lo sviluppo (ENEL semestrale, AAPL trimestrale, un ETF a distribuzione `VHYL.MI` trimestrale).

### Calcoli (`lib/investments/dividends.ts`, funzioni pure)

- **Dividendi da registrare**: per ogni stacco dalla prima operazione a oggi, le quote possedute alla chiusura del giorno prima (portate alle quote di oggi con gli split successivi, come l'importo di Yahoo). Se l'utente le possedeva e non c'è un dividendo registrato dello stesso strumento tra 5 giorni prima e 60 giorni dopo lo stacco (ogni dividendo registrato "copre" un solo stacco), si propone: lordo = quote × dividendo per quota, ritenuta stimata con l'aliquota dello strumento. Stessa cosa per le cedole delle obbligazioni con tasso e scadenza inseriti. "Registra" apre il form precompilato (data = stacco, da correggere con quella di pagamento): niente scrittura automatica, perché l'importo netto vero lo dice il broker e oggi un'operazione non si modifica dalla UI. "Ignora" la nasconde per sempre.
- **Previsione 12 mesi**: per le obbligazioni con tasso e scadenza, le cedole future (nominale × tasso / frequenza) e il rimborso a scadenza (mostrato ma non contato come provento). Periodo: i 12 mesi solari a partire dal prossimo. Per gli altri, gli stacchi dello stesso periodo un anno prima spostati di un anno × quote di oggi. Senza storico della fonte, i dividendi e le cedole registrati in quel periodo, riproporzionati alle quote di oggi. Netto = lordo × (1 − aliquota): ritenute estere non considerate, lo si dice. Raggruppata per mese di stacco.
- **Incassi mese per mese**: lordo (lordo × cambio), ritenute e commissioni registrate, netto; per anno.
- **Per strumento**: incassato netto 12 mesi, rendimento sul costo, rendimento attuale (lordo previsto / valore di oggi), crescita annua del dividendo per quota (CAGR sugli anni solari completi, fino a 5, con almeno 2 anni pagati).

## 5. Interfaccia

**Proventi**: riepilogo (card della Fase 2), "Prossimi 12 mesi" (i 12 mesi solari dal prossimo: totale netto, barre per mese, elenco dei prossimi incassi), "Da registrare" (Registra / Ignora, e "Ignora le N più vecchie di un anno" per chi ha importato uno storico senza dividendi), "Mese per mese" (anno selezionabile, barre impilate netto + ritenute), "Per strumento" con "Cedole" per inserire tasso e scadenza dei BTP.

**Tasse**: regime (selettore con spiegazione), "Anno" (selettore, cifre dell'anno e confronto stima/trattenute), "Zaino" (disponibile, scadenze per anno, minusvalenze pregresse con aggiungi/elimina), "Prima di vendere", "Opportunità", "Impostazioni fiscali degli strumenti" (aliquota e armonizzato per strumento, dialog condiviso con le cedole).

## 6. Route

- `PATCH /api/investments/portfolio`: anche `taxRegime`.
- `PUT /api/instruments/[id]/settings`: impostazioni fiscali e cedole dell'utente (tutto null = cancella).
- `POST /api/investments/tax-carryforwards`, `DELETE /api/investments/tax-carryforwards/[id]`.
- `POST` / `DELETE /api/investments/dividends/dismissed` (`{ items: [...] }`, una o più proposte).
- I dati nuovi arrivano con `GET /api/investments/overview` (`loadInvestmentData`), che avvia anche lo scaricamento dei dividendi mancanti.
- Eventi Umami: `investment_tax_regime_set`, `instrument_settings_saved`, `tax_carryforward_added`, `investment_dividend_dismissed`. Export e reset dell'account includono le tabelle per utente nuove.

## Rimandato consapevolmente

- Ritenute estere sui dividendi (credito d'imposta, 15% USA ecc.): la previsione del netto usa solo l'aliquota italiana.
- Quadri della dichiarazione (RT/RM/RW) compilati: si danno solo le cifre per anno.
- Date di pagamento dei dividendi (Yahoo dà solo lo stacco).
- Aliquota "mista" degli ETF obbligazionari con titoli di Stato (si imposta a mano un'aliquota tra le due disponibili).
- Registrazione automatica dei dividendi senza conferma.
