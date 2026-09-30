# Debiti — design

Data: 2026-09-30. Stato: **spec da approvare**, nessun codice scritto. Nasce da un brainstorming con l'utente (finanziamento personale a tasso fisso, credit Lombard con utilizzo variabile e tasso legato all'Euribor). La sezione 7 di `docs/functional-spec.md` (Debiti nel mockup) resta il riferimento per la UI originale: qui si decide cosa diventa nel prodotto reale.

## 1. Obiettivo

Tracciare i propri debiti, sapere quanto costano davvero e decidere come ripagarli: finanziamenti con piano di ammortamento (mutuo, prestito personale o auto) e linee di credito rotanti (credit Lombard, fido). Deve funzionare sia per debiti **già in corso** (con un pregresso da ricostruire) sia per debiti **che iniziano da ora**.

## 2. Principi

- **Il piano non si salva, si calcola.** Come le posizioni in Investimenti: la fonte di verità sono le condizioni iniziali e un **registro di eventi**; piano, residuo e interessi sono derivati.
- **"Ho fatto" e "e se" sono lo stesso motore.** Un'estinzione anticipata ipotetica nel simulatore e una reale registrata usano lo stesso calcolo; una simulazione si può promuovere a evento reale.
- **L'utente decide.** Regole di addebito interessi, soglie di allerta, spese accessorie, importi reali delle rate: sempre impostati dall'utente, l'app offre solo valori di partenza.
- **Sezione indipendente dalle Transazioni.** Nessun automatismo: una rata si segna pagata a mano. Il collegamento a una transazione è facoltativo e scelto dall'utente.
- **Gli investimenti sono un extra, mai un requisito.** Chi ha portafoglio in piattaforma riceve informazioni in più; chi no, usa tutto il resto.
- Tutti gli importi sono nella valuta dell'utente (nessun debito in valuta estera nella prima versione).

## 3. Modello concettuale

Due tipi di debito, con comportamenti diversi:

| Tipo | Come si comporta | Esempi |
|---|---|---|
| `loan` (finanziamento) | Capitale, tasso, durata: piano di ammortamento con rate | mutuo, prestito personale, prestito auto |
| `credit_line` (linea di credito) | Fido massimo, utilizzo variabile, interessi giornalieri sul saldo | credit Lombard, fido, carta revolving |

### 3.1 Finanziamento

Dati base: nome, capitale erogato, tasso (TAN), numero rate, data della prima rata, periodicità (mensile per ora), tipo di ammortamento (francese = rata costante, default; italiano = quota capitale costante, da valutare), **spese** (istruttoria, assicurazione, incasso rata: voci libere con importo, una tantum o per rata, decise dall'utente).

**Tasso fisso o variabile**: il finanziamento ha una lista di periodi di tasso (`da data → tasso`), quindi un cambio di tasso è un evento come gli altri. Il caso d'uso di oggi è un solo tasso fisso.

### 3.2 Calcolatore "la variabile che manca"

Nel form di creazione l'utente può non sapere una delle quattro grandezze capitale, rata, numero rate, tasso. Se ne fornisce tre, l'app calcola la quarta:

- capitale + rata + n. rate → **tasso** (TAN) e, con le spese inserite, **TAEG**;
- capitale + tasso + n. rate → **rata**;
- capitale + tasso + rata → **n. rate** (arrotondato per eccesso, con l'ultima rata ridotta);
- rata + tasso + n. rate → **capitale** (quanto si è ottenuto, utile per capire un'offerta).

Il tasso si ricava con un metodo numerico (bisezione/Newton sulla funzione di ammortamento, pura e testata), il TAEG come tasso interno di rendimento dei flussi comprese le spese. Le grandezze ricavate sono mostrate come "calcolato" e modificabili, e si indica che un arrotondamento della rata reale può far differire di poco il tasso. Serve anche al caso "debito in corso" (vedi 4) e al confronto di offerte nel simulatore.

### 3.3 Linea di credito (credit Lombard)

Dati base: nome, **fido massimo**, **tasso** (indice + spread, oppure fisso; l'indice è l'Euribor a una scadenza scelta dall'utente), data di apertura.

Regole di addebito **decise dall'utente** (l'app propone un default modificabile, nessuna regola è cablata):
- frequenza di addebito degli interessi (mensile, trimestrale, altra scadenza);
- base del giorno (360, 365, giorni effettivi);
- se gli interessi addebitati si sommano al capitale utilizzato (capitalizzazione) o si pagano a parte;
- eventuali spese fisse (commissione sul fido, sul non utilizzato).

Il dato variabile è il **saldo utilizzato**, che cambia nel tempo: si ricostruisce dagli eventi di utilizzo e rimborso. Gli interessi maturano giorno per giorno sul saldo di quel giorno, con il tasso in vigore (indice alla data + spread).

**Soglia di allerta**: impostata dall'utente in modo indipendente (percentuale del fido o importo assoluto). Quando l'utilizzato la supera, l'app lo segnala nella scheda e nel quadro d'insieme. Non è legata agli investimenti.

**Extra se ha investimenti** (facoltativo, solo in presenza di un portafoglio in piattaforma e se l'utente lo collega): rapporto utilizzato/valore del portafoglio, costo del credito (tasso effettivo) confrontato con il rendimento del portafoglio, effetto di un calo di mercato sul rapporto. Mai obbligatorio e mai visibile senza collegamento.

### 3.4 Registro eventi

| Evento | Vale per | Campi |
|---|---|---|
| Rata pagata | `loan` | rata di riferimento, data, importo reale, transazione collegata (facoltativa) |
| Estinzione anticipata | `loan` | data, importo, penale (facoltativa), effetto: riduci la rata o riduci la durata |
| Cambio tasso | `loan`, `credit_line` | data di efficacia, nuovo tasso o nuovo valore dell'indice |
| Utilizzo | `credit_line` | data, importo |
| Rimborso | `credit_line` | data, importo |
| Interessi addebitati | `credit_line` | data, importo reale addebitato (per correggere la stima) |
| Correzione del residuo | `loan`, `credit_line` | data, residuo reale (per riallineare dopo sospensioni o rinegoziazioni) |

Un evento non si modifica a mano sul piano: si modifica o si elimina l'evento e il piano si ricalcola.

## 4. Debiti in corso e debiti nuovi

All'aggiunta di un finanziamento l'utente sceglie, con una spiegazione di ciascuna strada:

- **Nuovo (da oggi)**: dati base, piano interamente nel futuro.
- **In corso, ricostruisci dall'origine**: inserisce i dati originali (capitale, tasso, rate, data di inizio). L'app genera il piano e mostra quante rate sono già passate. Le rate passate partono come "da confermare": l'utente le segna pagate in blocco ("tutte pagate fino a…") o una per una, e può correggerne importo e data.
  - Adatto quando si hanno i dati del contratto. Il pregresso è **calcolato**, quindi "stimato" finché non confermato, come lo storico derivato del patrimonio netto.
- **In corso, fotografia di oggi**: inserisce residuo attuale, rata, tasso e rate rimanenti (o, con il calcolatore 3.2, due qualsiasi di queste). L'app proietta solo il futuro, prima di quella data non c'è storico.
  - Adatto quando il contratto non c'è più o ha avuto modifiche. Il residuo è un evento "correzione del residuo" alla data di oggi.

Per la linea di credito l'equivalente è il saldo utilizzato iniziale (un evento di utilizzo alla data di inizio del tracciamento) senza obbligo di ricostruire il passato.

## 5. Estinzioni anticipate: "ho fatto" e "e se"

- **Registrata** (evento reale): l'utente inserisce data, importo e penale. Prima di confermare l'app mostra **le due alternative affiancate**: *riduci la rata* (stessa scadenza, rata più bassa) e *riduci la durata* (stessa rata, finisce prima), con interessi risparmiati e nuova data di fine per ciascuna. Il piano si ricalcola dalla data dell'evento e le rate precedenti restano congelate.
- **Simulata** (nessun evento salvato): stesso calcolo con importo e data ipotetici, anche ricorrenti (es. "extra di 100 € al mese"), con l'effetto sugli interessi totali. Un bottone "Registra come fatto" converte la simulazione in evento reale.
- Penale: campo libero (in euro o in percentuale dell'importo), incluso nel confronto costo/beneficio.

## 6. Interfaccia: schede come gli altri gruppi

Voce `/debiti` con schede a URL propri, stesso meccanismo di `SectionTabs` usato da Movimenti e Investimenti:

1. **Panoramica** (`/debiti`): debito totale (capitale residuo dei finanziamenti + utilizzato delle linee), rata mensile complessiva, interessi pagati finora e stimati da qui alla fine, data di libertà dai debiti, allerta Lombard se oltre soglia, prossime scadenze, grafico del residuo nel tempo.
2. **Finanziamenti** (`/debiti/finanziamenti`): una card per finanziamento, dettaglio con piano di ammortamento rata per rata (capitale, interessi, residuo, stato), rate segnabili pagate, registro eventi, bottone "Registra estinzione anticipata", selettore per vedere il piano di ciascuno (correzione dello stub del mockup).
3. **Lombard** (`/debiti/lombard`): per linea, utilizzato contro fido, tasso in vigore, interessi maturati nel mese e stima a saldo attuale, utilizzo medio, andamento dell'utilizzato, registro utilizzi/rimborsi, cambi tasso, soglia; sezione extra con investimenti se collegati.
4. **Simulatore** (`/debiti/simulatore`): estinzione anticipata ricorrente o una tantum, confronto con un'offerta di surroga (risparmio netto meno costi), scenario di rialzo dell'Euribor sulla linea di credito, confronto valanga/palla di neve tra più debiti.

Dialog condivisi nel layout: "Aggiungi debito" (con scelta nuovo/in corso e calcolatore 3.2), "Registra evento".

## 7. Integrazioni

- **Patrimonio netto**: nuova classe di asset `debiti` (negativa) nelle righe di `net_worth_snapshots` (colonna `text`, nessuna modifica di schema). Residuo dei finanziamenti e utilizzato delle linee entrano in Panoramica; lo storico passato si ricostruisce dagli eventi con lo stesso meccanismo di `refreshDerivedInvestmentHistory` (impronta su Redis, riscrittura dei soli giorni cambiati). Da valutare con l'utente se la card "Dove sta il tuo patrimonio" mostra i debiti come riga separata.
- **Transazioni**: nessuna dipendenza. Collegamento facoltativo transazione ↔ rata/evento: un campo `transactionId` sull'evento, scelto dall'utente da un picker; nessuna modifica automatica alla categoria o all'importo della transazione.
- **Euribor**: nella prima versione l'utente aggiorna l'indice a mano (evento "cambio tasso"). Un aggiornamento automatico dell'indice (come l'€STR dal cron `market-prices`) si valuta dopo, scegliendo una fonte libera affidabile: da verificare, non data per scontata.
- **Investimenti**: sola lettura del valore del portafoglio e del rendimento, solo per le informazioni extra della scheda Lombard.
- Sidebar e login: quando la schermata esiste si toglie `comingSoon` da `NAV_ITEMS` e si rimuove la voce da `UPCOMING_FEATURES` (vedi CLAUDE.md).

## 8. Architettura (riuso dei pattern esistenti)

- Logica pura in `lib/calc/` (`amortization.ts`: piano, solver delle variabili mancanti, TAEG; `credit-line.ts`: interessi giornalieri, regole di addebito; `debt-events.ts`: applicazione degli eventi al piano). Tutto testabile senza DB, come `lib/calc/returns.ts`.
- Tabelle previste (schema definitivo nel piano): `debts` (tipo, nome, parametri, modalità di avvio), `debt_events` (registro eventi con data, tipo, importi, `transactionId` facoltativo), `debt_rate_periods` (periodi di tasso o valori dell'indice), impostazioni della linea di credito (regole di addebito, soglia). Migration versionata via `db:generate`, come da regola del progetto.
- Route con `withRoute("debts.<azione>", …)` e `bindRequestUser`, eventi Umami categorici (`debt_added`, `debt_event_added`, …) via `track()`, log senza importi né nomi, come da standard di osservabilità. Export dell'account e reset includono le tabelle nuove.
- Le operazioni di ricalcolo sono leggere (piani di qualche centinaio di righe): calcolo sincrono nella richiesta, nessun job in background.

## 9. Fasi

1. **Motore e finanziamenti**: calcolo del piano, calcolatore della variabile mancante, registro eventi, modalità nuovo/in corso, rate segnate a mano, scheda Panoramica e Finanziamenti.
2. **Estinzioni anticipate** reali e simulate, con il confronto "riduci rata / riduci durata".
3. **Lombard**: linea di credito, utilizzi e rimborsi, tasso indice + spread, regole di addebito dell'utente, soglia, scheda Lombard.
4. **Integrazioni e simulatore completo**: classe `debiti` nel patrimonio netto con storico derivato, extra con investimenti, surroga, scenario Euribor, valanga/palla di neve, scheda Simulatore.

Ogni fase è una PR a sé. La Fase 3 può partire in parallelo alla 2 perché il motore degli eventi è della 1.

## 10. Decisioni prese e rimandate

**Decise** (brainstorming 2026-09-30): debiti in corso con scelta spiegata tra ricostruzione dall'origine e fotografia di oggi; rate solo nel piano, segnate a mano, collegamento facoltativo alle transazioni; Lombard da subito; estinzione anticipata sia reale ("ho fatto") sia simulata ("e se"); regole di addebito del Lombard, spese del finanziamento e soglia di allerta decise dall'utente; soglia indipendente dagli investimenti; calcolatore della variabile mancante; interfaccia a schede.

**Rimandate** (da riprendere dopo la Fase 4): aggiornamento automatico dell'Euribor; debiti in valuta estera; ammortamento "all'italiana" se non serve subito; mutui con tasso misto o cap; debiti informali senza tasso (prestiti tra persone) come tipo dedicato; notifiche push sulle scadenze; separazione nel Cash flow tra quota capitale e quota interessi (oggi la rata intera conta come spesa, scelta da rivedere insieme alle Transazioni); import del piano da documento della banca.

## 11. Da verificare con l'utente al momento di costruire

Regole esatte del proprio Lombard (frequenza, base giorni, capitalizzazione) e del finanziamento (spese, assicurazione, penale di estinzione) dal contratto; se i dati di partenza delle rate passate coincidono con il piano teorico, altrimenti usare la correzione del residuo.
