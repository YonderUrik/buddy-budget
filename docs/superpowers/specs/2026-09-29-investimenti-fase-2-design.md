# Investimenti, Fase 2: rendimenti e confronto

**Data**: 2026-09-29
**Stato**: design scritto il 2026-09-29 su richiesta dell'utente ("avevamo detto che c'erano altre fasi, possiamo occuparcene?", scelta la Fase 2 tra 2/3/4/6). Eseguito inline nella stessa sessione, sul branch `claude/investimenti-fase-2`.
**Spec madre**: `2026-09-27-investimenti-design.md`, sezione 1 (roadmap).

## Obiettivo

Rispondere a tre domande che la Fase 1 lascia aperte:

1. **Quanto sta rendendo davvero il portafoglio?** Il "guadagno %" della Fase 1 è guadagno totale / totale acquistato: con un PAC è distorto (i soldi entrati ieri pesano come quelli entrati tre anni fa) e non è confrontabile con un indice.
2. **Avrei fatto meglio con un indice?** Stessi versamenti, stesse date, in un ETF di riferimento scelto dall'utente.
3. **Sto battendo l'inflazione?**

Più due pezzi di contorno previsti in roadmap: gli **split** (oggi gestiti a mano con vendita + acquisto) e lo **storico di dividendi e cedole**.

## Decisioni

### 1. Due rendimenti, sullo stesso periodo del grafico

Il periodo è quello già scelto nella card principale (1M/3M/1A/Max): cambiare periodo aggiorna anche i rendimenti.

- **Rendimento del portafoglio (TWR, time-weighted)**: quanto hanno reso gli strumenti scelti, indipendentemente da quando e quanto hai versato. È il numero da confrontare con un indice o un fondo.
  Si concatena giorno per giorno: `r_t = (V_t + Uscite_t + Proventi_t) / (V_{t-1} + Entrate_t) − 1`, con le entrate (acquisti, commissioni incluse) all'inizio della giornata e le uscite (incasso netto di vendite e rimborsi) e i proventi netti alla fine. Scelta motivata: con la convenzione "tutti i flussi a inizio giornata" una vendita totale in guadagno darebbe un denominatore negativo. Un giorno con denominatore ≤ 0 (niente in portafoglio e nessun acquisto) non conta.
- **Il tuo rendimento (money-weighted, XIRR)**: quanto hanno reso i *tuoi soldi*, tenendo conto di quando li hai messi. Flussi dal punto di vista dell'utente: valore a inizio periodo come versamento iniziale, acquisti negativi, vendite/rimborsi/proventi positivi, valore di oggi positivo. Newton con ripiego a bisezione; null se non converge o se i flussi non cambiano segno.
- **Annualizzazione**: il numero principale è sempre "sul periodo". Solo se il periodo copre almeno un anno si mostra anche la versione annua (TWR annuo e XIRR). Motivo: "+80% annuo" dopo due mesi fuorvia.
- Il valore giornaliero è quello della Fase 1 (`computeDailyPortfolioValues`), che ora espone anche totale acquistato e proventi cumulati. Stessi limiti: uno strumento senza prezzo o cambio in un giorno non conta nel valore di quel giorno.

### 2. Confronto con un indice ("benchmark")

- Il benchmark è **uno strumento del catalogo** (tipicamente un ETF azionario globale), scelto dall'utente con lo stesso selettore della Fase 1; solo strumenti con prezzi automatici. Si salva sul portafoglio: nuova colonna `investment_portfolios.benchmark_instrument_id` (nullable, `on delete set null`). Nessun default: finché l'utente non lo sceglie, la card propone di farlo.
- Scelto il benchmark si scarica il suo storico dalla prima operazione (stesso recupero in background della Fase 1), e il cron serale lo aggiorna come uno strumento posseduto.
- **Simulazione "stessi versamenti"**: a inizio periodo si "compra" benchmark per il valore del portafoglio, poi ogni giorno si compra per le entrate e si vende per uscite + proventi, al prezzo di chiusura convertito nella valuta dell'utente. Mirroring anche dei proventi: così i prelievi sono identici e i due valori finali si confrontano direttamente ("oggi avresti X invece di Y"). Se un prelievo supera il valore del benchmark simulato, si vende tutto (il benchmark non va sotto zero): caso raro, accettato.
- Si mostrano: TWR del benchmark sul periodo (prezzo finale / prezzo iniziale, in valuta utente) accanto al TWR del portafoglio, valore finale simulato contro valore reale, e un grafico a due linee del rendimento cumulato (portafoglio vs benchmark, in %), con la stessa granularità del grafico principale.
- Per un ETF ad accumulazione il prezzo include già i dividendi reinvestiti; per uno a distribuzione no, e il confronto lo penalizza. Si dice nel testo di aiuto.

### 3. Rendimento reale (inflazione)

- Fonte: **Eurostat HICP**, indice mensile `prc_hicp_midx` (base 2015=100, `coicop=CP00`), area **Italia** (`geo=IT`). Nuova tabella `inflation_index (area, month 'YYYY-MM', value, source)`, comune a tutti gli utenti: l'area è una colonna, quindi aggiungere l'area euro in futuro non richiede migrazioni.
- Aggiornamento dentro il cron `market-prices` (una chiamata, ultimi 3 anni; se la tabella è vuota dal 2000). Un errore di Eurostat non fa fallire il cron: si logga `market.inflation.failed`.
- Rendimento reale = `(1 + TWR) / (1 + inflazione del periodo) − 1`, inflazione = indice dell'ultimo mese disponibile ≤ fine periodo / indice del mese di inizio. Si mostra **solo** se la valuta dell'utente è EUR e il periodo è 1A o Max (Eurostat pubblica con circa un mese di ritardo: su 1M/3M il dato sarebbe sfasato). Si dice fino a quale mese arriva l'inflazione.
- Fonti finte (`MARKET_DATA_FAKE=1`) hanno anche un indice d'inflazione finto (2% annuo) per lo sviluppo locale.

### 4. Split

- Nuovo tipo di operazione **`split`**. Il rapporto sta nel campo `quantity`: quote nuove per ogni quota vecchia (2 = ogni quota diventa due; 0,1 = raggruppamento 10:1). Prezzo, lordo, commissioni e imposte a zero. Nessuna migrazione (i tipi sono `text`).
- Effetto: quote × rapporto, costo di carico invariato (quindi il prezzo medio si divide per il rapporto). Coerente in posizioni, esito delle singole operazioni (gli acquisti aperti moltiplicano le quote rimaste), controllo "vendute più quote di quelle possedute" e ricerca degli strumenti posseduti del cron (uno strumento con uno split si considera posseduto: la somma SQL di acquisti e vendite non vede lo split).
- **Limite noto**: le fonti (Yahoo) restituiscono uno storico già corretto per gli split. Le chiusure salvate prima dello split restano quelle non corrette, quelle recuperate dopo sono corrette. Il valore di oggi è giusto; il grafico prima dello split può avere un gradino se lo storico è stato scaricato dopo lo split. Non corretto in questa fase.
- L'import CSV non traduce nessun valore in `split` da solo (va scelto a mano nella mappatura), e lo accetta solo con il rapporto nella colonna delle quote.

### 5. Storico di dividendi e cedole

Nuova card "Dividendi e cedole", visibile solo se c'è almeno un provento:
- totale netto degli ultimi 12 mesi e **rendimento da proventi sul costo** (ultimi 12 mesi / costo di carico attuale);
- barre per anno (netto incassato), dall'anno del primo provento;
- strumenti che hanno pagato di più negli ultimi 12 mesi.
Logica pura in `lib/investments/income.ts`, dai proventi già calcolati per la lista operazioni.

## Dove sta il codice

- `lib/calc/returns.ts`: flussi giornalieri, TWR, XIRR, annualizzazione, simulazione benchmark, serie del rendimento cumulato, inflazione. Tutto puro e testato.
- `lib/calc/investments.ts`: tipo `split`, punti giornalieri con `bought`/`income` cumulati.
- `lib/investments/view.ts`: aggiunge `returns` e `income` alla vista.
- `lib/investments/data.ts`: carica benchmark (strumento, prezzi, cambio) e indice d'inflazione.
- `lib/market-data/providers/eurostat.ts` + `lib/market-data/inflation.ts`: fonte e salvataggio.
- `app/api/investments/portfolio/route.ts`: `PATCH { benchmarkInstrumentId }`.
- UI: `components/domain/investments/returns-card.tsx` (+ grafico), `income-history-card.tsx`, campo "Rapporto" nel form operazione.
- Migration `0003_investimenti_fase_2`.

## Rimandato consapevolmente

- Correzione dello storico prezzi attorno a uno split.
- Più benchmark contemporanei, benchmark composti (es. 60/40), benchmark per singola posizione.
- Inflazione dell'area euro o di altri paesi, e per valute diverse da EUR.
- Rendimento per singola posizione (TWR/XIRR per strumento).
- Fiscalità (Fase 4) e rischio (Fase 3).

## Da verificare dopo il merge (non verificabile dal sandbox)

- Eurostat risponde dalla VPS (dal sandbox la policy di rete blocca `ec.europa.eu`): dopo il primo giro del cron la tabella `inflation_index` ha righe, e la card mostra il rendimento reale su 1A/Max.
- Scegliere un benchmark vero (es. VWCE) scarica lo storico e il confronto compare.
