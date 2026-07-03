# BuddyBudget — Specifica funzionale dettagliata (dal mockup)

## Metodologia

Questo documento nasce dall'esecuzione **interattiva** del mockup (`docs/design-reference/mock-up.html`) in un browser reale (servito localmente, non aperto come `file://`), cliccando ogni bottone, filtro, slider e campo di ogni schermata per verificare cosa è realmente cablato in JavaScript e cosa è solo scenografia statica. Non è quindi una lettura del solo markup, ma un test comportamentale.

**Perché questo documento esiste**: la sintesi in `product-vision.md` ("Funzionalità core dedotte dal mockup") era incompleta — il mockup reale ha 9 aree, non 7, e diverse funzionalità (simulatori what-if, gestione titoli, piano di rientro debiti) non erano rappresentate affatto. Questo file è la fonte di verità dettagliata; `product-vision.md` resta la sintesi ad alto livello e rimanda qui per i dettagli.

## Struttura globale dell'interfaccia

- **Sidebar di navigazione**, con comportamento responsive a tre modalità:
  - **Desktop (≥ 1024px)**: sidebar fissa a sinistra, espansa (240 px), sempre visibile. Contiene logo/brand "Patrimonio", 9 voci di navigazione, card utente ("MR" / "Marco Rossi" / "Piano personale") e toggle tema. L'utente può **collassarla manualmente** tramite un pulsante ◀/▶ in fondo: entra in modalità *icon-only* (64 px, solo icone + tooltip al hover). Lo stato espansa/collassata è persistito in `localStorage`.
  - **Tablet (768–1023px)**: sidebar fissa automaticamente in modalità *icon-only* (64 px) indipendentemente dallo stato salvato. Hover sulle icone mostra un tooltip con il nome della voce.
  - **Mobile (< 768px)**: sidebar non visibile. Compare una **topbar minimale** in cima (logo + hamburger button + toggle tema). Premendo l'hamburger si apre un **drawer** da sinistra con la sidebar in versione espansa; toccare l'overlay o navigare chiude il drawer.
  - Logo/brand "Patrimonio" (non cliccabile), navigazione a 9 voci — **Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche** — card utente e toggle tema chiaro/scuro sono presenti in tutte le modalità (adattati graficamente).

- **Nessuna topbar**, nessuna ricerca globale, nessuna notifica, nessun pulsante "aggiungi" globale (ogni azione di inserimento vive dentro la schermata pertinente).
- Il cambio schermata è istantaneo (SPA client-side, nessun reload, nessun URL/hash che cambia — la navigazione del browser indietro/avanti non è utilizzabile per spostarsi tra le sezioni).
- **Lo stato è tenuto in memoria JS condivisa tra le schermate**: modifiche fatte in una sezione (es. una spesa "divisa" a metà) restano visibili tornando sulla stessa sezione più tardi nella sessione, ma **si perdono al refresh della pagina** — non c'è alcuna persistenza (né localStorage, né backend).

---

## 1. Panoramica

**Scopo**: vista d'insieme giornaliera su patrimonio netto, liquidità, investimenti, pensione e ultimi movimenti.

**Cosa si vede**:
- Data corrente in italiano esteso ("Lunedì 30 giugno 2026")
- Selettore periodo **1M / 3M / 1A / Max** (funzionante: cambia l'etichetta "ultimi N" sotto il patrimonio netto e presumibilmente il grafico associato — i valori aggregati in alto non cambiano)
- Card "Patrimonio netto" con variazione assoluta e percentuale, grafico andamento
- 4 mini-card asset: Liquidità, Spese del mese (con barra di avanzamento sul budget), Titoli, Pensione — ciascuna con etichetta "Auto" o "Manuale" a indicare la fonte dato
- Lista "Ultimi movimenti" (7 righe, sola lettura) con link **"Vedi tutti"**
- Blocco "Allocazione patrimonio" con ripartizione percentuale per asset class

**Cosa si può fare**:
- Cambiare il periodo di riferimento del grafico patrimonio (1M/3M/1A/Max) — **funzionante**, aggiorna l'etichetta testuale.

**Cosa NON si può fare (limitazioni verificate)**:
- **"Vedi tutti" non fa nulla**: cliccandolo non si apre una lista estesa né si naviga altrove. È uno stub visivo.
- Nessun movimento è modificabile o eliminabile da questa schermata (l'edit dei movimenti manuali avviene solo in "Spese" o "Investimenti").
- Nessun modo per aggiungere un movimento da qui.
- Il grafico "Andamento" è un'immagine, non ha tooltip/hover con valori puntuali testati come funzionanti.

---

## 2. Conti

**Scopo**: gestione della liquidità che alimenta spese e transazioni ("la base di spese e transazioni").

**Cosa si vede**:
- 3 KPI: Liquidità totale, Conti collegati (conteggio), Patrimonio netto
- Elenco conti, ciascuno con: iniziali/istituto, nome conto, banca · tipo, etichetta **Auto** o **Manuale**, saldo, bottone **✕** (rimuovi)
- I conti manuali (es. "Contanti") hanno **nome e saldo modificabili inline** (campi di testo direttamente nella riga)
- Bottone **"+ Aggiungi conto"**

**Cosa si può fare (verificato funzionante)**:
- **Aggiungere un conto manuale**: cliccando "+ Aggiungi conto" compare una nuova riga "Nuovo conto / Conto · manuale" con saldo 0, editabile subito.
- **Modificare nome e saldo di un conto manuale** direttamente nella riga (campo di testo): il cambiamento **ricalcola in tempo reale** Liquidità totale, Conti collegati e Patrimonio netto in alto.
- **Rimuovere qualsiasi conto** (✕) — inclusi quelli marcati "Auto" (collegati). Il ricalcolo dei totali è immediato.

**Cosa NON si può fare / limitazioni**:
- Non esiste un vero collegamento bancario: i conti "Auto" sono dati statici precaricati, "✕" li rimuove localmente ma non c'è un flusso di "ricollega banca" o OAuth con l'istituto.
- **Incoerenza di design**: nel mondo reale un conto collegato via open banking non dovrebbe essere modificabile/eliminabile a piacere dall'utente allo stesso modo di uno manuale — nel mockup invece il comportamento è identico. Da decidere nel prodotto reale se replicare questa libertà o vincolarla.
- Non si può modificare banca/tipo conto (es. da "Corrente" a "Deposito") per i conti manuali: quei campi non sono editabili, solo nome e saldo lo sono.
- Nessuna conferma prima di eliminare un conto (nessun modale "sei sicuro?").
- Nessuna validazione visibile sul campo saldo (accetta qualunque testo/numero, non testato con input non numerico).

---

## 3. Spese

**Scopo**: tracciamento e categorizzazione delle uscite, con logica di budget mensile.

**Cosa si vede**:
- Selettore periodo **Settimana / Mese / 3 mesi / Anno**
- 3 KPI: Speso nel periodo (su budget), Budget rimanente (con giorni rimasti), Media giornaliera (vs periodo precedente)
- Blocco "Per categoria": 8 categorie fisse (Affitto, Spesa alimentare, Altro, Ristoranti, Bollette & casa, Svago, Trasporti, Abbonamenti) con relativo importo
- Blocco "Fisse vs variabili" (donut) + "Andamento ultimi 6 mesi" (barre gen–giu)
- Lista **Transazioni**, con sommario Uscite / Escluse / Spese effettive
- Per ogni transazione: descrizione, data · categoria, importo, etichetta Auto/Manuale, bottone **"Dividi"**
- Le transazioni **manuali** hanno anche: descrizione editabile, importo editabile, bottone **✕**
- Form di inserimento in fondo: Descrizione, Categoria (menu a tendina con le 8 categorie), Importo €, Data, bottone **"+ Aggiungi"**

**Cosa si può fare (verificato funzionante)**:
- **Cambiare periodo** (Settimana/Mese/3 mesi/Anno): aggiorna etichetta data, "Speso", "Budget rimanente" e giorni rimasti con **numeri diversi e coerenti per periodo** (es. Settimana: € 640 su € 740).
- **"Dividi" su qualunque transazione (anche Auto)**: apre uno slider "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)". Muovendolo si ripartisce l'importo tra "Spesa effettiva" ed "Esclusa dal conteggio", e i totali Uscite/Escluse/Spese effettive in alto **si aggiornano in tempo reale**. Lo stato resta impostato anche cambiando schermata e tornando indietro.
- **Modificare descrizione e importo** delle transazioni manuali (campo di testo inline).
- **Eliminare** una transazione manuale (✕).

**Cosa NON si può fare / limitazioni importanti**:
- **Il selettore di periodo non filtra realmente la lista sottostante**: cambiando a "Settimana" i tre KPI in alto cambiano, ma "Per categoria", "Fisse vs variabili", il grafico a 6 mesi e la lista Transazioni **restano quelli di giugno**. Sono dataset precotti per periodo applicati solo alle card in alto, non un motore di filtro reale sulle transazioni.
- **Il form "+ Aggiungi" in fondo è uno stub**: compilando Descrizione/Categoria/Importo/Data e cliccando "+ Aggiungi" **non succede nulla** — nessuna nuova riga compare, il form non si svuota, nessun totale cambia. Nel mockup attuale non esiste quindi un vero flusso di inserimento spesa manuale end-to-end, solo il suo involucro visivo.
- Lo slider "Dividi" **non ricalcola** le card in alto (Speso/Budget rimanente/Media giornaliera) né "Per categoria": tocca solo il mini-sommario Uscite/Escluse/Spese effettive della lista transazioni. Sono due sistemi di calcolo scollegati.
- Non è possibile modificare la categoria di una transazione esistente (solo descrizione e importo sono editabili inline).
- Non è possibile modificare la data di una transazione esistente.
- Le transazioni "Auto" non sono modificabili né eliminabili (solo "Dividi" funziona su di esse) — coerente con l'idea che arrivino da un collegamento bancario.
- Nessuna paginazione/ricerca/filtro per categoria nella lista transazioni: è una lista fissa e breve.

---

## 4. Cash flow

**Scopo**: entrate, uscite e distribuzione del denaro — corrisponde concettualmente a "Entrate" nella vecchia vision, ma è più ampio (unisce entrate + destinazione dell'avanzo).

**Cosa si vede**: interamente **sola lettura**, nessun input, nessun bottone di modifica.
- 4 KPI: Entrate medie, Uscite medie (esclusi trasferimenti interni), Flusso netto, Tasso di risparmio
- Grafico "Entrate vs uscite" ultimi 12 mesi (barre affiancate lug–giu)
- "Fonti di entrata": Stipendio, Freelance, Dividendi e interessi, ciascuna con importo e quota % sul totale
- "Dove va ogni euro" (mese corrente): Spese fisse, Spese variabili, Investimenti (PAC), Risparmio liquido — con importo e %
- "Risparmio accumulato" ultimi 12 mesi (grafico + totale)

**Cosa si può fare**: nulla, è un cruscotto di analisi puro.

**Cosa NON si può fare / limitazioni**:
- Non esiste alcun modo di aggiungere/modificare una fonte di entrata (es. cambiare lo stipendio, aggiungere un lavoro extra) da questa schermata: i dati sembrano derivare passivamente dalle transazioni marcate come entrate altrove, ma quel collegamento non è dimostrato nel mockup (non c'è un posto esplicito dove si inseriscono le entrate).
- Nessun selettore di periodo (a differenza di Panoramica/Spese/Investimenti), quindi sempre "ultimi 12 mesi"/mese corrente fissi.

---

## 5. Investimenti

**Scopo**: portafoglio titoli, transazioni di acquisto/vendita, composizione.

**Cosa si vede**:
- 3 KPI: Valore portafoglio (con variazione giornaliera), Guadagno totale, Investito (con importo PAC mensile)
- Tabella titoli (Strumento, Quote, Prezzo €, Valore, P&L) per VWCE, SWDA, AAPL, AGGH — **Quote e Prezzo sono campi di testo editabili**, con bottone ✕ per rimuovere la riga
- Riga "aggiungi titolo": Ticker, Nome, Quote, Prezzo, bottone **"+ Aggiungi"**
- Blocco "Registra una transazione": toggle Acquisto/Vendita, select Strumento, Quote (accetta frazionarie es. 4,4), Prezzo €, Data, "Totale" calcolato, bottone **"+ Registra"**
- Lista "Transazioni recenti" con ✕ per rimuovere
- 3 blocchi di composizione, tutti sola lettura: Tipologia di asset (ETF azionari/Azioni singole/Obbligazioni), Geografia (stima dalla composizione ETF), Settore (stima dalla composizione ETF)

**Cosa si può fare (verificato funzionante)**:
- **Modificare Quote o Prezzo** di un titolo esistente: **ricalcola in tempo reale** Valore riga, Valore portafoglio, Guadagno totale e la ripartizione "Tipologia di asset" (percentuali incluse).
- **Rimuovere un titolo** (✕) o una transazione recente (✕).

**Cosa NON si può fare / limitazioni**:
- **"+ Aggiungi" (nuovo titolo) è uno stub**: compilando Ticker/Nome/Quote/Prezzo e cliccando, nessuna riga viene aggiunta alla tabella. A differenza del bottone quasi identico su "Conti" (che invece funziona), qui il comportamento è solo visivo.
- **"+ Registra" (nuova transazione) è uno stub**: il "Totale" resta a "—" e non compare mai in "Transazioni recenti", indipendentemente da cosa si inserisce nel form.
- Il toggle Acquisto/Vendita non ha effetto osservabile (nessuna transazione viene comunque registrata).
- "Geografia" e "Settore" **non si aggiornano** quando si modificano Quote/Prezzo dei titoli, a differenza di "Tipologia di asset" che invece reagisce: sono presentati come "stima" statica, quindi l'incoerenza è forse voluta ma va decisa esplicitamente nel prodotto reale.
- Non è possibile modificare Ticker o Nome di un titolo esistente (solo Quote e Prezzo).
- Nessuna sincronizzazione reale con mercati/prezzi live: "Prezzo €" è un valore manuale, nonostante l'header dica "Portafoglio titoli · sincronizzato".

---

## 6. Pensione

**Scopo**: fondo pensione integrativo, con simulatore di proiezione.

**Cosa si vede**:
- 3 KPI: Valore attuale (editabile), Versato finora (editabile), Rendimento maturato (calcolato, sola lettura)
- Blocco "Parametri" con 3 slider: Versamento mensile (€), Rendimento reale (%/anno), Età di pensionamento (anni)
- "Proiezione a N anni": cifra finale stimata + grafico + range temporale
- "Da dove arriva il valore": Versato vs Rendimento (scomposizione dell'attuale valore)

**Cosa si può fare (verificato funzionante)**:
- **Modificare "Valore attuale" e "Versato finora"** manualmente (campo di testo) — riflette l'idea che questi dati vadano aggiornati a mano "dall'ultimo estratto conto del fondo" (non c'è integrazione automatica).
- **Simulatore what-if pienamente funzionante**: spostando uno qualsiasi dei 3 slider (versamento mensile, rendimento atteso, età di pensionamento) la **proiezione finale si ricalcola istantaneamente** (verificato: età 67→64 anni porta la proiezione da ≈€431.000 a ≈€379.000).

**Cosa NON si può fare / limitazioni**:
- Un solo fondo pensione gestibile: non c'è un "+ Aggiungi fondo" per chi ne ha più di uno.
- Nessuna cronologia dei versamenti (solo un totale cumulato "Versato finora", non una lista di movimenti come in Spese/Investimenti).
- La proiezione è dichiaratamente "una stima deterministica, non una promessa" (nessun modello probabilistico/Monte Carlo).

---

## 7. Debiti

**Scopo**: mutuo e prestiti, con piano di rientro e simulatore di estinzione anticipata.

**Cosa si vede**:
- 3 KPI: Debito totale, Rata mensile (con % sulle entrate), Interessi ancora da pagare
- Una card per debito (nel mockup: Mutuo prima casa, Prestito auto), ciascuna con:
  - Nome editabile, istituto/tipo tasso, bottone ✕
  - Residuo, TAEG, Rata mensile — tutti **editabili**
  - Slider "Extra sulla rata" (sovrapprezzo mensile volontario)
  - Esito: "Estinto nel [anno]" (con anticipo rispetto al piano), "Interessi risparmiati"
  - Grafico piano "Con extra" vs "Piano attuale"
- Blocco "Aggiungi un debito": Nome, Residuo €, TAEG %, Rata €/mese, bottone **"+ Aggiungi"**
- Tabella "Prossime rate" (5 mesi: mese, interessi, capitale, residuo) per un debito specifico
- "Il quadro completo": Attività finanziarie, **Immobile (stima)**, Debiti, Patrimonio reale

**Cosa si può fare (verificato funzionante)**:
- **Simulatore di estinzione anticipata per debito, pienamente funzionante**: spostando lo slider "Extra sulla rata" di un debito, **"Estinto nel" e "Interessi risparmiati" si ricalcolano subito** (verificato sul Prestito auto: +€250/mese → estinzione anticipata di 1 anno e 5 mesi, € 286 di interessi risparmiati).
- Modificare Nome, Residuo, TAEG, Rata mensile di un debito esistente (campi di testo — non verificato se ricalcolano a cascata il piano di ammortamento).
- Rimuovere un debito (✕).

**Cosa NON si può fare / limitazioni**:
- **"+ Aggiungi debito" è uno stub**, come gli analoghi in Spese/Investimenti: compilare il form e cliccare non crea alcuna nuova card debito.
- **"Immobile (stima): € 265.000" non è editabile da nessuna parte**: appare come testo statico solo nel riquadro "Il quadro completo" di questa pagina. Non esiste una sezione "Immobili/Patrimonio reale" dedicata né un modo per l'utente di inserire/aggiornare il valore di un immobile — è un gap concettuale evidente: il mockup introduce il concetto di patrimonio immobiliare solo qui, senza gestirlo altrove (né in Conti, né in Panoramica, dove "Patrimonio netto" sembra invece essere solo liquidità + investimenti + pensione, escludendo l'immobile).
- La tabella "Prossime rate" mostra solo il mutuo, non il prestito auto, e non è chiaro se sia selezionabile per un altro debito (nessun controllo di selezione visibile/testato).
- Nessuna conferma prima di eliminare un debito.

---

## 8. Pianifica

**Scopo**: la funzionalità più avanzata del mockup — un simulatore "what-if" di scenari di vita che proietta l'impatto sul patrimonio nel lungo periodo. Sostituisce concettualmente "Budget"/"Risparmi" della vecchia vision con qualcosa di più ampio.

**Cosa si vede**:
- 3 scenari **disattivabili/attivabili singolarmente**: "Cambio lavoro" (+€450/mese netti dal 2027), "Acquisto casa" (−€15.000 subito, +€200/mese dal 2028), "Un figlio" (+€600/mese di spese dal 2028)
- Parametri globali: Orizzonte (anni), Rendimento atteso (%/anno), Risparmio mensile base (€) — tutti a slider
- Grafico "Proiezione del patrimonio": confronto "Con scenari" vs "Ritmo attuale" fino all'anno target
- Riepilogo numerico: valore finale con scenari (+differenza vs ritmo attuale) e valore finale a ritmo attuale

**Cosa si può fare (verificato funzionante, la sezione più solida del mockup)**:
- **Attivare/disattivare ciascuno scenario** cliccandolo: attivandolo compaiono i suoi slider specifici (es. per "Acquisto casa": Costi iniziali, Effetto mensile dopo, Anno di acquisto) e **la proiezione finale cambia immediatamente** (verificato: attivando "Acquisto casa" la proiezione 2046 passa da € 853.259 a € 885.598).
- **Ogni scenario ha parametri indipendenti** regolabili via slider una volta attivato.
- **Modificare i parametri globali** (orizzonte, rendimento atteso, risparmio mensile base): impattano la proiezione allo stesso modo.
- Gli scenari sono combinabili tra loro (più di uno attivo contemporaneamente).

**Cosa NON si può fare / limitazioni**:
- Solo 3 scenari predefiniti e fissi ("Cambio lavoro", "Acquisto casa", "Un figlio"): non è possibile crearne uno personalizzato (es. "Anno sabbatico", "Trasferimento all'estero").
- Nessun salvataggio degli scenari configurati: modificando gli slider e cambiando pagina, al ritorno lo stato **potrebbe** essere preservato in memoria (coerente col comportamento osservato in Spese) ma comunque perso al refresh — non esiste un modo per "salvare uno scenario" con nome e confrontarlo in futuro.
- Nessun collegamento esplicito tra gli scenari e i dati reali delle altre schermate (es. attivare "Un figlio" non crea automaticamente una nuova categoria di spesa in "Spese").
- Etichetta esplicita nel mockup: "una stima deterministica, non una promessa" — nessun intervallo di confidenza o simulazione probabilistica.

---

## 9. Analitiche

**Scopo**: insight avanzati che un'app di budgeting tradizionale di solito non fornisce. Interamente **sola lettura**, nessun input in tutta la pagina.

**Cosa si vede** (7 blocchi, tutti calcolati passivamente dai dati delle altre sezioni):
1. **Da dove arriva la tua crescita**: quota della crescita patrimoniale attribuibile a risparmio personale vs rendimento di mercato (barra proporzionale + valori)
2. **Autonomia finanziaria**: mesi di sopravvivenza con la sola liquidità attuale rispetto alla spesa media, con barra di avanzamento verso un obiettivo (24 mesi)
3. **Tasso di risparmio reale**: percentuale, con nota esplicita che i giroconti tra conti propri non contano come risparmio
4. **Indipendenza finanziaria (FIRE)**: patrimonio necessario secondo la "regola del 4%" e anno/età stimati di raggiungimento al ritmo attuale
5. **Rendimento reale**: nominale − inflazione = reale, per capire il potere d'acquisto effettivo
6. **Inflazione del tuo stile di vita**: crescita della spesa media personale anno su anno, confrontata con l'inflazione ufficiale
7. **Radar abbonamenti**: elenco abbonamenti ricorrenti rilevati (Palestra, Netflix, Spotify, iCloud) con costo mensile/annuo e totale annuo

**Cosa si può fare**: nulla, è consultazione pura.

**Cosa NON si può fare / limitazioni**:
- Nessun modo di modificare l'obiettivo di "Autonomia finanziaria" (24 mesi è fisso) o il tasso della regola FIRE (4% è fisso, non parametrico come invece lo sono gli slider in Pensione/Debiti/Pianifica).
- "Radar abbonamenti" è una lista chiusa e statica: non c'è un modo per aggiungere/rimuovere un abbonamento monitorato, né un collegamento visibile alla categoria "Abbonamenti" già vista in Spese (che nel mockup vale € 77/mese, mentre qui il totale annuo implica una media di € 77/mese sui 4 abbonamenti elencati — coerente, ma il collegamento dati non è dimostrato, potrebbe essere un dataset a parte).
- Nessun periodo selezionabile: tutti i calcoli sono fissi su "ultimi 12 mesi" o sul mese corrente, senza possibilità di confronto storico oltre ai pochi mesi già mostrati nei mini-grafici.

---

## Tabella riepilogativa: funzionante vs stub

| Elemento | Schermata | Comportamento |
|---|---|---|
| Selettore periodo 1M/3M/1A/Max | Panoramica | Funzionante (etichetta) |
| "Vedi tutti" movimenti | Panoramica | **Stub**, nessun effetto |
| "+ Aggiungi conto" | Conti | **Funzionante**, ricalcola i totali |
| Modifica nome/saldo conto manuale | Conti | Funzionante, live |
| "✕" rimuovi conto | Conti | Funzionante (anche su conti "Auto") |
| Selettore periodo Settimana/Mese/3 mesi/Anno | Spese | Parzialmente funzionante: cambia solo le 3 KPI in alto |
| "Dividi" transazione | Spese | Funzionante, live, anche su transazioni Auto |
| Modifica descrizione/importo transazione manuale | Spese | Funzionante |
| "✕" elimina transazione manuale | Spese | Funzionante |
| Form "+ Aggiungi" transazione | Spese | **Stub**, nessun effetto |
| Modifica Quote/Prezzo titolo | Investimenti | Funzionante, live, ricalcola portafoglio e "Tipologia di asset" |
| "✕" rimuovi titolo/transazione | Investimenti | Funzionante |
| "+ Aggiungi" nuovo titolo | Investimenti | **Stub** |
| "+ Registra" transazione titolo | Investimenti | **Stub** |
| Modifica Valore attuale/Versato | Pensione | Funzionante |
| Slider proiezione pensione | Pensione | Funzionante, live |
| Modifica Residuo/TAEG/Rata debito | Debiti | Funzionante (campo editabile) |
| Slider "Extra sulla rata" | Debiti | Funzionante, live |
| "✕" rimuovi debito | Debiti | Funzionante |
| "+ Aggiungi" nuovo debito | Debiti | **Stub** |
| Attivazione scenari + slider | Pianifica | Funzionante, live |
| Toggle tema chiaro/scuro | Globale (sidebar) | Funzionante |
| Tutta la pagina Cash flow | Cash flow | Sola lettura |
| Tutta la pagina Analitiche | Analitiche | Sola lettura |

**Pattern osservato**: ogni bottone il cui testo inizia con **"+ Aggiungi"/"+ Registra" per creare una nuova riga in una lista** è uno stub non funzionante, **tranne** "+ Aggiungi conto" in Conti, che è l'unico realmente cablato. Modificare/rimuovere righe **esistenti**, invece, funziona quasi ovunque. È il segnale più concreto di dove concentrare lo sforzo quando si passerà dal mockup a un'implementazione reale con persistenza.

---

## Limitazioni trasversali del mockup (valide per tutte le schermate)

- **Nessuna persistenza**: tutto lo stato vive in memoria JS della singola sessione di pagina; un refresh del browser riporta tutto ai valori iniziali.
- **Nessun backend/API**: nessuna chiamata di rete osservata oltre al caricamento della pagina stessa.
- **Nessuna autenticazione**: l'utente "Marco Rossi / Piano personale" è hardcoded, non c'è login/logout, non c'è multi-utente o multi-piano nonostante l'etichetta "Piano personale" lasci intendere che potrebbero esisterne altri.
- **Nessuna validazione input**: i campi numerici (saldi, quote, importi, TAEG) non sono stati osservati rifiutare input non validi; il comportamento con testo non numerico non è definito.
- **Nessuna conferma per azioni distruttive**: ogni "✕" elimina immediatamente, senza dialogo di conferma.
- **Nessuna gestione errori/stati di caricamento/stati vuoti**: non essendoci rete, non ci sono stati "in caricamento" o "errore"; gli stati vuoti (es. zero conti, zero spese) non sono osservabili perché ogni schermata parte già popolata con dati demo.
- **Valuta fissa (EUR) e lingua fissa (italiano)**: nessun selettore.
- **Nessun responsive testato**: il mockup è stato verificato solo a risoluzione desktop; il comportamento mobile/tablet della sidebar e delle tabelle a più colonne non è noto.
- **Incoerenze di ricalcolo tra schermate**: i "motori" di calcolo non sono unificati. Esempi concreti già osservati:
  - Panoramica mostra "Spese del mese € 2.870 su € 3.200" identico a Spese → probabilmente stesso dato sorgente, ma il ricalcolo del "Dividi" in Spese non si propaga a quella cifra.
  - "Patrimonio netto" in Panoramica/Conti sembra escludere il valore immobiliare che invece compare in Debiti → "Patrimonio reale" (Attività finanziarie + Immobile − Debiti). Sono due definizioni di patrimonio diverse coesistenti senza essere riconciliate esplicitamente.
- **Il concetto di "Immobile/proprietà immobiliare" è introdotto ma non gestito**: appare solo come riga statica in Debiti → "Il quadro completo", senza una sezione propria, senza possibilità di modifica, senza collegamento a un eventuale mutuo associato.

## Implicazioni per il modello dati reale (spunti, non prescrittivo)

Per l'implementazione reale (fuori dallo scope di questo documento, che è descrittivo del mockup) queste osservazioni suggeriscono che il modello dati dovrà probabilmente comprendere, oltre alle entità già previste in `product-vision.md` (conti, transazioni, categorie, budget, obiettivi):
- Una nozione esplicita di **fonte del dato per riga** (manuale vs collegata/auto), non solo per i conti ma anche per transazioni e titoli, con regole di editabilità diverse per le due fonti.
- Un concetto di **"quota esclusa dal conteggio"** per transazione (il meccanismo "Dividi"), distinto dall'importo nominale della transazione.
- Un'entità **titolo/posizione di portafoglio** con quote e prezzo, indipendente dalle singole transazioni di acquisto/vendita che la generano.
- Un'entità **debito** con piano di ammortamento calcolabile (non solo importo e rata, ma un motore capace di ricalcolare estinzione anticipata).
- Una decisione esplicita se includere **beni non liquidi (immobili)** nel patrimonio netto, e se sì, come modellarli e dove renderli gestibili dall'utente.
- Un motore di **scenario/proiezione** riutilizzabile (usato sia in Pensione che in Debiti che in Pianifica con logiche simili ma non condivise nel mockup).
