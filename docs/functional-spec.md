# BuddyBudget — Specifica funzionale dettagliata (dal mockup)

## Metodologia

Questo documento nasce dall'esecuzione **interattiva** del mockup (`docs/design-reference/mock-up.html`) in un browser reale (servito localmente, non aperto come `file://`), cliccando ogni bottone, filtro, slider e campo di ogni schermata per verificare cosa è realmente cablato in JavaScript e cosa è solo scenografia statica. Non è quindi una lettura del solo markup, ma un test comportamentale.

**Perché questo documento esiste**: la sintesi in `product-vision.md` ("Funzionalità core dedotte dal mockup") era incompleta — il mockup reale ha 9 aree, non 7, e diverse funzionalità (simulatori what-if, gestione titoli, piano di rientro debiti) non erano rappresentate affatto. Questo file è la fonte di verità dettagliata; `product-vision.md` resta la sintesi ad alto livello e rimanda qui per i dettagli.

**Cosa questo documento NON è**: non è (solo) un resoconto **descrittivo** di un singolo file HTML statico, senza backend, senza persistenza e con un budget di interazioni limitato a ciò che il designer del mockup ha avuto tempo di cablare in JavaScript. Ogni voce **"Cosa il mockup NON implementa"** è seguita da una **decisione esplicita per il prodotto reale**: implementarla (e con quale comportamento) oppure escluderla consapevolmente (e perché). L'assenza di una funzionalità nel mockup non viene lasciata come domanda aperta senza risposta — o viene risolta qui, o viene segnalata esplicitamente come domanda ancora da porre all'utente. Le decisioni prese in questo documento sono registrate anche nel "Log delle decisioni" di `CLAUDE.md`; in caso di conflitto futuro con `product-vision.md` o con nuove decisioni lì registrate, queste ultime prevalgono sempre su quanto scritto qui.

## Struttura globale dell'interfaccia

- **Sidebar di navigazione**, con comportamento responsive a tre modalità:
  - **Desktop (≥ 1024px)**: sidebar fissa a sinistra, espansa (240 px), sempre visibile. Contiene logo/brand "Patrimonio", 9 voci di navigazione, card utente ("MR" / "Marco Rossi" / "Piano personale") e toggle tema. L'utente può **collassarla manualmente** tramite un pulsante ◀/▶ in fondo: entra in modalità *icon-only* (64 px, solo icone + tooltip al hover). Lo stato espansa/collassata è persistito in `localStorage`.
  - **Tablet (768–1023px)**: sidebar fissa automaticamente in modalità *icon-only* (64 px) indipendentemente dallo stato salvato. Hover sulle icone mostra un tooltip con il nome della voce.
  - **Mobile (< 768px)**: sidebar non visibile. Compare una **topbar minimale** in cima (logo + hamburger button + toggle tema). Premendo l'hamburger si apre un **drawer** da sinistra con la sidebar in versione espansa; toccare l'overlay o navigare chiude il drawer.
  - Logo/brand "Patrimonio" (non cliccabile), navigazione a 9 voci — **Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche** — card utente e toggle tema chiaro/scuro sono presenti in tutte le modalità (adattati graficamente).

- **Topbar desktop e pulsante "aggiungi" globale**: assenti nel mockup. **Decisione: restano assenti anche nel prodotto reale.** Ogni inserimento resta ancorato alla schermata di dominio (spesa in Spese, titolo in Investimenti, ecc.): un pulsante "+" globale dovrebbe comunque aprire il form della sezione pertinente, quindi non aggiunge valore e introduce solo un instradamento in più da mantenere.
- **Ricerca globale**: assente nel mockup. **Decisione: va implementata**, ma non nel MVP — quando il volume di dati (conti, transazioni, titoli) cresce oltre i pochi elementi demo, una ricerca che salti direttamente a un conto/transazione/titolo diventa utile; con poche righe come nel mockup non lo è. Rimandata a una fase successiva alla messa in produzione delle schermate base.
- **Notifiche**: assenti nel mockup. **Decisione: non implementarle per ora.** Non esiste ancora nel prodotto un concetto di evento che meriti una notifica (nessun alert di sforamento budget, nessuna scadenza rata, nessuna collaborazione multi-utente); introdurle richiede prima definire quali eventi contano, il che è fuori scope in questa fase.
- Il cambio schermata è istantaneo (SPA client-side, nessun reload, nessun URL/hash che cambia — la navigazione del browser indietro/avanti non è utilizzabile per spostarsi tra le sezioni).
- **Lo stato è tenuto in memoria JS condivisa tra le schermate**: modifiche fatte in una sezione (es. una spesa "divisa" a metà) restano visibili tornando sulla stessa sezione più tardi nella sessione, ma **si perdono al refresh della pagina** — non c'è alcuna persistenza (né localStorage, né backend). Vedi la decisione sulla persistenza nelle "Limitazioni trasversali" più sotto.

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **"Vedi tutti" è uno stub** (nessun effetto). **Decisione: implementare** — deve portare a una vista estesa dei movimenti, riutilizzando la lista Transazioni già presente in "Spese" (eventualmente filtrata su "tutte le fonti"), non una lista nuova da mantenere in parallelo.
- **Nessun movimento modificabile o eliminabile da qui**. **Decisione: mantenere così** — l'editing dei movimenti resta ancorato alla schermata di dominio (Spese o Investimenti), coerente con il principio "un'azione, una schermata" già seguito nel resto del mockup; duplicarlo qui creerebbe due punti di verità per lo stesso dato.
- **Nessun modo per aggiungere un movimento da qui**. **Decisione: mantenere così**, stesso motivo del punto precedente.
- **Il grafico "Andamento" non ha tooltip/hover con valori puntuali**. **Decisione: implementare** — un grafico di andamento senza valori puntuali al passaggio del mouse è sotto lo standard atteso per un grafico interattivo; è un limite dell'immagine statica usata nel mockup, non una scelta di design.

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Nessun vero collegamento bancario** (i conti "Auto" sono dati statici precaricati; "✕" li rimuove solo localmente). **Decisione: fuori scope per ora** — un'integrazione Open Banking/PSD2 reale è un progetto a sé (provider terzo, consenso OAuth, sincronizzazione ricorrente). Il prodotto reale parte con soli conti manuali; il collegamento bancario resta un'estensione futura esplicita, da pianificare separatamente quando si sceglie il provider.
- **Incoerenza di design**: i conti "Auto" sono modificabili/eliminabili esattamente come i manuali. **Decisione: correggere nel prodotto reale** — un conto collegato non deve avere saldo/nome modificabili a mano (derivano dalla banca): l'unica azione permessa deve essere "Scollega conto" (con conferma), che rimuove il collegamento senza pretendere di editare un dato che non possediamo.
- **Banca/tipo conto non modificabili** per i conti manuali (solo nome e saldo lo sono). **Decisione: implementare** — non c'è motivo di prodotto per impedire di correggere banca/tipo dopo la creazione; è una scorciatoia del mockup, non una scelta.
- **Nessuna conferma prima di eliminare un conto**. **Decisione: implementare** un dialogo di conferma per qualunque eliminazione — standard per azioni distruttive, non specifico del dominio finanziario.
- **Nessuna validazione visibile sul campo saldo**. **Decisione: implementare** validazione numerica/formato valuta su tutti i campi importo, qui come nel resto dell'app.

---

## 3. Spese

**Scopo**: tracciamento e categorizzazione delle uscite, con logica di budget mensile.

**Cosa si vede**:
- Selettore periodo **Settimana / Mese / 3 mesi / Anno**
- 3 KPI: Speso nel periodo (su budget), Budget rimanente (con giorni rimasti), Media giornaliera (vs periodo precedente)
- Blocco "Per categoria": categorie personalizzabili dall'utente (pagina `/categorie`), ciascuna appartenente a uno di quattro **gruppi di spesa** — **Dovute** (spese necessarie: senza queste avresti problemi pratici o legali), **Volute** (migliorano la qualità della vita ma potresti farne a meno), **Te futuro** (risparmio/investimenti trattati come spesa prioritaria, non come ciò che avanza) e **Saltuarie** (necessarie ma non mensili: tasse, manutenzioni, regali) — più la categoria fallback "Da categorizzare" (fuori da ogni gruppo). Il donut ha l'**anello interno per gruppo** (una fetta per gruppo, più "Da categorizzare" se presente) e l'anello esterno per singola categoria, allineati angolarmente.
- Blocco "Andamento ultimi 6 mesi" (barre, stacked per categoria)
- Lista **Transazioni**, con sommario Uscite / Escluse / Spese effettive
- Per ogni transazione: descrizione, data · categoria, importo, etichetta Auto/Manuale, bottone **"Dividi"**
- Le transazioni **manuali** hanno anche: descrizione editabile, importo editabile, bottone **✕**
- Form di inserimento in fondo: Descrizione, Categoria (menu a tendina con le 8 categorie), Importo €, Data, bottone **"+ Aggiungi"**

**Cosa si può fare (verificato funzionante)**:
- **Cambiare periodo** (Settimana/Mese/3 mesi/Anno): aggiorna etichetta data, "Speso", "Budget rimanente" e giorni rimasti con **numeri diversi e coerenti per periodo** (es. Settimana: € 640 su € 740).
- **"Dividi" su qualunque transazione (anche Auto)**: apre uno slider "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)". Muovendolo si ripartisce l'importo tra "Spesa effettiva" ed "Esclusa dal conteggio", e i totali Uscite/Escluse/Spese effettive in alto **si aggiornano in tempo reale**. Lo stato resta impostato anche cambiando schermata e tornando indietro.
- **Modificare descrizione e importo** delle transazioni manuali (campo di testo inline).
- **Eliminare** una transazione manuale (✕).

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Il selettore di periodo non filtra realmente la lista sottostante**: cambiando a "Settimana" i tre KPI in alto cambiano, ma "Per categoria" (donut per gruppo/categoria), il grafico a 6 mesi e la lista Transazioni restano quelli di giugno. **Decisione: implementare correttamente** — cambiare periodo deve ricalcolare in modo coerente KPI, categorie, grafici e lista transazioni: nel mockup è una scorciatoia dei dati demo, non un comportamento voluto. (Implementato: il periodo ricalcola anche il donut e il trend.)
- **Il form "+ Aggiungi" in fondo è uno stub** (nessun effetto osservabile). **Decisione: implementare end-to-end** — è probabilmente il flusso più usato dell'intera app; deve creare la riga, aggiornare la lista transazioni e ricalcolare tutti i totali.
- **Lo slider "Dividi" non ricalcola le card in alto** (Speso/Budget rimanente/Media giornaliera/Per categoria): sono due sistemi di calcolo scollegati. **Decisione: unificare** — deve esistere un solo motore di calcolo della spesa "effettiva" per periodo, e "Dividi" deve rientrarci ovunque; il disallineamento del mockup è un bug da non portare nel prodotto reale.
- **Categoria non modificabile** su una transazione esistente. **Decisione: implementare** — correggere una spesa mal categorizzata è un'azione basilare che deve esistere.
- **Data non modificabile** su una transazione esistente. **Decisione: implementare**, stesso motivo.
- **Transazioni "Auto" non modificabili né eliminabili** (solo "Dividi" funziona su di esse). **Decisione: mantenere come nel mockup** — coerente con l'idea che arrivino da un collegamento bancario: modificarle localmente falsificherebbe il dato sorgente, mentre "Dividi" è un overlay che non tocca l'importo originale, quindi resta l'unica azione sensata su questo tipo di riga.
- **Nessuna paginazione/ricerca/filtro per categoria** nella lista transazioni. **Decisione: implementare** quando il volume reale di transazioni supera la manciata di righe demo — necessario con dati reali su più mesi, non necessario finché il dataset è piccolo (es. primi mesi d'uso).

---

## 4. Cash flow

**Scopo**: entrate, uscite e distribuzione del denaro — corrisponde concettualmente a "Entrate" nella vecchia vision, ma è più ampio (unisce entrate + destinazione dell'avanzo).

**Cosa si vede**: interamente **sola lettura**, nessun input, nessun bottone di modifica.
- 4 KPI: Entrate medie, Uscite medie (esclusi trasferimenti interni), Flusso netto, Tasso di risparmio
- Grafico "Entrate vs uscite" ultimi 12 mesi (barre affiancate lug–giu)
- "Fonti di entrata": Stipendio, Freelance, Dividendi e interessi, ciascuna con importo e quota % sul totale
- "Dove va ogni euro" (mese corrente): **Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo** — con importo e %, pallino colorato per le quattro voci di gruppo. "Te futuro" (risparmio/investimenti) conta come spesa a tutti gli effetti; "Non classificato" copre sia le spese sulla categoria fallback "Da categorizzare" sia quelle su una categoria sconosciuta; "Avanzo" (entrate − tutte le uscite, "Te futuro" incluso) è l'ex "Risparmio", rinominato per non essere ambiguo ora che il risparmio vero e proprio è già contato dentro "Te futuro"
- "Risparmio accumulato" ultimi 12 mesi (grafico + totale)

**Cosa si può fare**: nulla, è un cruscotto di analisi puro.

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Nessun modo di aggiungere/modificare una fonte di entrata** da questa schermata. **Decisione: non qui, ma da qualche parte sì.** Cash flow resta un cruscotto derivato e di sola lettura; l'inserimento delle entrate (stipendio, freelance, dividendi) deve però esistere concretamente, verosimilmente come transazioni di tipo "entrata" inserite nello stesso flusso di "Spese" (da generalizzare concettualmente a "Transazioni" con segno positivo/negativo), non in un form separato qui. Il gap nel mockup non era una scelta di design: il punto di inserimento semplicemente non era mai stato mostrato.
- **Nessun selettore di periodo** (a differenza di Panoramica/Spese/Investimenti). **Decisione: implementare** — è un'incoerenza del mockup rispetto alle altre schermate con dati temporali, non un design intenzionale; va aggiunto un selettore periodo (es. 3M/6M/12M/24M) per coerenza con il resto dell'app.

---

## 5. Investimenti

**Scopo**: portafoglio titoli, transazioni di acquisto/vendita, composizione.

**Cosa si vede**:
- 3 KPI: Valore portafoglio (con variazione giornaliera), Guadagno totale, Investito
- Tabella titoli (Strumento, Quote, Prezzo €, Valore, P&L) per VWCE, SWDA, AAPL, AGGH — **Quote e Prezzo sono campi di testo editabili**, con bottone ✕ per rimuovere la riga
- Riga "aggiungi titolo": Ticker, Nome, Quote, Prezzo, bottone **"+ Aggiungi"**
- Blocco "Registra una transazione": toggle Acquisto/Vendita, select Strumento, Quote (accetta frazionarie es. 4,4), Prezzo €, Data, "Totale" calcolato, bottone **"+ Registra"**
- Lista "Transazioni recenti" con ✕ per rimuovere
- 3 blocchi di composizione, tutti sola lettura: Tipologia di asset (ETF azionari/Azioni singole/Obbligazioni), Geografia (stima dalla composizione ETF), Settore (stima dalla composizione ETF)

**Cosa si può fare (verificato funzionante)**:
- **Modificare Quote o Prezzo** di un titolo esistente: **ricalcola in tempo reale** Valore riga, Valore portafoglio, Guadagno totale e la ripartizione "Tipologia di asset" (percentuali incluse).
- **Rimuovere un titolo** (✕) o una transazione recente (✕).

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **"+ Aggiungi" (nuovo titolo) è uno stub**: nessuna riga viene aggiunta alla tabella. **Decisione: implementare end-to-end**, analogo a "+ Aggiungi conto" che invece già funziona nel mockup.
- **"+ Registra" (nuova transazione) è uno stub**: il "Totale" resta a "—" e non compare mai in "Transazioni recenti". **Decisione: implementare end-to-end** — deve creare la riga in "Transazioni recenti" e aggiornare quote/valore del titolo corrispondente.
- **Il toggle Acquisto/Vendita non ha effetto osservabile**. **Decisione: implementare** — una "Vendita" deve ridurre le quote possedute (con controllo che non si vendano più quote di quante possedute), non limitarsi a registrare un acquisto mascherato.
- **"Geografia" e "Settore" non si aggiornano** quando si modificano Quote/Prezzo dei titoli, a differenza di "Tipologia di asset" che invece reagisce. **Decisione: correggere** — devono aggiornarsi allo stesso modo: due blocchi "vivi" e uno statico, senza motivo apparente, confonderebbe l'utente.
- **Ticker e Nome non modificabili** su un titolo esistente (solo Quote e Prezzo lo sono). **Decisione: implementare solo in parte** — il Ticker resta non modificabile dopo la creazione (identifica univocamente lo strumento quotato, cambiarlo non avrebbe senso finanziario), ma il Nome sì, per correggere un'etichetta inserita male.
- **Nessuna sincronizzazione reale con prezzi di mercato**, nonostante l'header dica "sincronizzato". **Decisione: implementare, ma come fase successiva** — richiede un'integrazione con un provider di prezzi esterno, fuori scope del design system attuale; nel frattempo l'header non dovrebbe promettere una sincronizzazione che non esiste, e "Prezzo €" resta comunque modificabile manualmente come fallback anche dopo l'integrazione.

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Un solo fondo pensione gestibile** (nessun "+ Aggiungi fondo"). **Decisione: implementare il supporto multi-fondo** — avere più forme di previdenza integrativa (es. fondo negoziale + PIP) è comune, e la schermata deve poterne gestire più di uno.
- **Nessuna cronologia dei versamenti** (solo un totale cumulato "Versato finora"). **Decisione: implementare** una lista dei versamenti nel tempo, coerente con lo storico già presente in Spese/Investimenti — utile per vedere l'andamento dei contributi.
- **Proiezione deterministica, non un modello probabilistico/Monte Carlo**. **Decisione: non implementare** una simulazione probabilistica in questa fase — aggiungerebbe complessità statistica che il target di prodotto ("senza gergo finanziario", da `product-vision.md`) non richiede; si mantiene la proiezione deterministica con l'etichetta esplicita già presente nel mockup ("una stima, non una promessa").

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **"+ Aggiungi debito" è uno stub**. **Decisione: implementare end-to-end**, come per Conti/Investimenti/Spese.
- **"Immobile (stima): € 265.000" non è editabile e non è gestito in nessun'altra schermata** (né in Conti, né in Panoramica, dove "Patrimonio netto" sembra escluderlo). **Decisione: implementare come entità di prodotto** — serve un concetto esplicito di "bene non liquido" (immobile), inseribile/modificabile dall'utente. Sul conflitto osservato nel mockup (patrimonio netto con e senza immobile), il prodotto reale deve mostrare **entrambe le cifre esplicitamente etichettate** (es. "Patrimonio netto liquido" vs "Patrimonio netto incluso immobile"), non solo una delle due come fa oggi il mockup. Dove va inserito il valore dell'immobile nel dettaglio (sezione propria vs dentro Conti) resta da definire in fase di modellazione dati.
- **La tabella "Prossime rate" mostra solo un debito**, senza un controllo di selezione visibile. **Decisione: implementare** un selettore (o tab) per vedere il piano rate di ciascun debito, non solo del primo.
- **Nessuna conferma prima di eliminare un debito**. **Decisione: implementare**, stesso motivo di Conti.

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Solo 3 scenari predefiniti e fissi**, non è possibile crearne uno personalizzato. **Decisione: implementare scenari personalizzati** — i 3 scenari del mockup vanno trattati come template di partenza, ma l'utente deve poter crearne uno proprio (nome libero, effetto una tantum, effetto mensile, anno di inizio): un simulatore what-if realmente utile non può limitarsi a 3 casi fissi.
- **Nessun salvataggio degli scenari configurati** (si perdono al refresh, non esiste un modo per "salvare uno scenario" con nome). **Decisione: implementare persistenza e confronto** — poter salvare uno scenario con un nome e confrontarlo nel tempo è parte del valore centrale di questa schermata; senza salvataggio il simulatore resta "usa e getta" a ogni sessione.
- **Nessun collegamento esplicito tra gli scenari e i dati reali delle altre schermate** (es. attivare "Un figlio" non crea automaticamente una categoria di spesa in Spese). **Decisione: mantenere disaccoppiato, non collegare automaticamente** — un'attivazione di scenario che modifica silenziosamente dati in un'altra schermata sarebbe un effetto collaterale sorprendente e difficile da annullare; gli scenari restano proiezioni ipotetiche di sola lettura, separate dai dati reali.
- **Nessun intervallo di confidenza o simulazione probabilistica** (proiezione dichiaratamente deterministica, "una stima, non una promessa"). **Decisione: non implementare**, stesso motivo di Pensione — complessità statistica non richiesta dal target di prodotto.

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

**Cosa il mockup NON implementa — decisione per il prodotto reale**:
- **Obiettivo "Autonomia finanziaria" (24 mesi) e tasso della regola FIRE (4%) sono fissi**, a differenza degli slider parametrici di Pensione/Debiti/Pianifica. **Decisione: renderli parametrici** — è un'incoerenza del mockup senza motivazione di dominio: l'utente deve poter impostare il proprio obiettivo di mesi di autonomia e, per chi lo desidera, il tasso di prelievo FIRE.
- **"Radar abbonamenti" è una lista chiusa e statica**, senza collegamento dimostrato alla categoria "Abbonamenti" di Spese. **Decisione: implementare come rilevamento derivato** — deve essere calcolato automaticamente dalle transazioni ricorrenti categorizzate come abbonamento in Spese (stesso dato sorgente, non un dataset parallelo), con la possibilità per l'utente di correggere falsi positivi/negativi (rimuovere un "abbonamento" rilevato per errore, o segnalarne uno mancato).
- **Nessun periodo selezionabile** (tutto fisso a 12 mesi/mese corrente). **Decisione: implementare un confronto storico** (almeno 12/24 mesi) — necessario perché voci come "Inflazione del tuo stile di vita anno su anno" richiedono per definizione un confronto multi-periodo, non solo l'ultimo anno fisso.

---

## Tabella riepilogativa: funzionante vs stub (nel mockup)

| Elemento | Schermata | Comportamento nel mockup |
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

**Pattern osservato nel mockup**: ogni bottone il cui testo inizia con **"+ Aggiungi"/"+ Registra" per creare una nuova riga in una lista** è uno stub non funzionante, **tranne** "+ Aggiungi conto" in Conti, che è l'unico realmente cablato. Modificare/rimuovere righe **esistenti**, invece, funziona quasi ovunque. **Decisione: tutti gli stub di questa tabella vanno implementati end-to-end nel prodotto reale** (dettagliato per schermata nelle sezioni sopra) — è il segnale più concreto di dove concentrare lo sforzo quando si passerà dal mockup a un'implementazione reale con persistenza.

---

## Limitazioni trasversali del mockup (valide per tutte le schermate) — decisione per il prodotto reale

- **Nessuna persistenza** (tutto lo stato vive in memoria JS della singola sessione di pagina). **Decisione: ovviamente da implementare** — è l'intera differenza tra un mockup e un prodotto: richiede backend + database, non è una domanda aperta.
- **Nessun backend/API**. **Decisione: ovviamente da implementare**, stesso motivo.
- **Nessuna autenticazione** (utente "Marco Rossi / Piano personale" hardcoded, nessun login/logout). **Decisione: l'autenticazione va implementata** (anche minimale, per proteggere dati finanziari personali). **Il multi-utente/multi-piano resta invece una domanda aperta genuina**: `product-vision.md` non specifica se serve una gestione familiare/multi-piano nonostante l'etichetta "Piano personale" lasci intendere che potrebbero esisterne altri — va chiarito con l'utente prima di progettare quel modello dati.
- **Nessuna validazione input** sui campi numerici (saldi, quote, importi, TAEG). **Decisione: implementare** validazione su tutti i campi numerici/data in ogni schermata — standard, non specifico del dominio.
- **Nessuna conferma per azioni distruttive** (ogni "✕" elimina immediatamente). **Decisione: implementare** conferma su ogni azione distruttiva, ovunque nell'app.
- **Nessuna gestione di errori/stati di caricamento/stati vuoti**. **Decisione: implementare** — con un backend reale questi stati esistono per forza (rete lenta, richieste fallite, utente nuovo senza dati) e vanno progettati per ogni schermata quando si passa dai dati demo a dati reali.
- **Valuta fissa (EUR) e lingua fissa (italiano)**, nessun selettore. **Decisione: capovolta (2026-07-03)** — il prodotto reale deve supportare multi-lingua e multi-valuta, non solo italiano/EUR come nel mockup. Lingua e valuta sono impostazioni per-utente scelte durante l'**onboarding** (non un selettore globale sempre visibile in UI), con l'italiano/EUR come default sensato ma non l'unica opzione. Restano da decidere in un secondo momento: quali lingue/valute supportare al lancio, la libreria di i18n da adottare, e come/dove si formattano numeri e date in base alla valuta/lingua scelta.
- **Nessun responsive testato oltre desktop** nel mockup originale. **Parzialmente già risolto**: la sidebar responsive è stata implementata (vedi log decisioni in `CLAUDE.md`, voce 2026-07-03). **Decisione: da completare** per il resto dell'interfaccia (tabelle a più colonne, form) man mano che si costruiscono le schermate reali.
- **Incoerenze di ricalcolo tra schermate** (motori di calcolo non unificati — es. il "Dividi" in Spese non si propaga alla cifra "Spese del mese" mostrata in Panoramica; "Patrimonio netto" in Panoramica/Conti esclude l'immobile che invece compare in Debiti → "Patrimonio reale"). **Decisione: unificare** — un solo motore di calcolo condiviso per ogni cifra derivata (spesa effettiva, patrimonio netto, ecc.), letto da tutte le schermate che lo mostrano, invece di dataset paralleli come nel mockup.
- **Il concetto di "Immobile/proprietà immobiliare" introdotto ma non gestito** (appare solo come riga statica in Debiti → "Il quadro completo"). **Decisione**: vedi la voce dedicata nella sezione Debiti sopra — richiede un'entità dedicata e una scelta esplicita su come entra nel patrimonio netto mostrato all'utente.

## Implicazioni per il modello dati reale

Le decisioni sopra richiedono che il modello dati reale comprenda, oltre alle entità già previste in `product-vision.md` (conti, transazioni, categorie, budget, obiettivi):
- Una nozione esplicita di **fonte del dato per riga** (manuale vs collegata/auto), non solo per i conti ma anche per transazioni e titoli, con regole di editabilità diverse per le due fonti (le collegate sono di sola lettura salvo "scollega"; le manuali sono pienamente editabili).
- Un concetto di **"quota esclusa dal conteggio"** per transazione (il meccanismo "Dividi"), distinto dall'importo nominale della transazione, e che si propaghi a **tutti** i calcoli derivati (non solo al mini-sommario locale come nel mockup).
- Un'entità **titolo/posizione di portafoglio** con quote e prezzo, indipendente dalle singole transazioni di acquisto/vendita che la generano, con vendite che decrementano le quote possedute.
- Un'entità **debito** con piano di ammortamento calcolabile (non solo importo e rata, ma un motore capace di ricalcolare estinzione anticipata), selezionabile individualmente per la tabella rate.
- Un'entità **bene non liquido (immobile)**, gestibile dall'utente, con una scelta esplicita di come entra nelle cifre di patrimonio netto mostrate (mostrare entrambe le varianti, con/senza immobile).
- Un motore di **scenario/proiezione** riutilizzabile e condiviso (usato sia in Pensione che in Debiti che in Pianifica con logiche simili ma non condivise nel mockup), con supporto a scenari personalizzati salvabili con nome (per Pianifica).
- Un concetto di **abbonamento ricorrente rilevato automaticamente** dalle transazioni categorizzate, non una lista statica separata (per Analitiche → Radar abbonamenti).
