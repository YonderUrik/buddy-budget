package io.buddybudget.core.domain.analytics

// Long-form Analitiche content (Italian catalog sources, translate in the UI): glossary (ANA-032), «Come leggerla»
// explainers and the 6-step walkthrough (ANA-005). Generated from the web's components/domain/analytics/{glossary,
// explainers,walkthrough-steps}.ts — same entries and order on iOS (`AnalyticsContent.swift`).

data class AnalyticsGlossaryEntry(val id: String, val title: String, val text: String, val match: List<String>)

data class AnalyticsExplainerSource(val label: String, val url: String?)

data class AnalyticsExplainer(
    val id: String,
    val title: String,
    val what: String,
    val read: String,
    val how: String,
    val limits: String,
    val sources: List<AnalyticsExplainerSource>,
)

data class AnalyticsWalkthroughStep(val title: String, val body: List<String>)

object AnalyticsContent {
    val glossary: List<AnalyticsGlossaryEntry> = listOf(
        AnalyticsGlossaryEntry(
            "numero-fire", "Numero FIRE",
            "Il capitale che basterebbe per vivere del solo rendimento del patrimonio, senza più lavorare. Si calcola come spesa annua ÷ tasso di prelievo: con 30.000 € di spesa e il 3,5%, circa 857.000 €.",
            listOf("numero fire", "fire"),
        ),
        AnalyticsGlossaryEntry(
            "tasso-prelievo", "Tasso di prelievo",
            "La quota del patrimonio che prelevi ogni anno per vivere. Con il 3,5% prelevi 3.500 € ogni 100.000 €. Più è basso, più il patrimonio dura, ma più capitale ti serve.",
            listOf("tasso di prelievo"),
        ),
        AnalyticsGlossaryEntry(
            "rendimento-reale", "Rendimento reale",
            "Il rendimento al netto dell'inflazione. Con un 6% nominale e un'inflazione del 2% il reale è circa 4%. Per questo tutte le cifre sono in euro di oggi.",
            listOf("rendimento reale"),
        ),
        AnalyticsGlossaryEntry(
            "euro-di-oggi", "Euro di oggi",
            "Gli importi futuri sono espressi con il potere d'acquisto di oggi: 100.000 € tra 30 anni valgono quanto ciò che oggi comprano 100.000 €. Così il confronto è onesto.",
            listOf("euro di oggi"),
        ),
        AnalyticsGlossaryEntry(
            "simulazione", "Scenari simulati (Monte Carlo)",
            "Il computer prova migliaia di futuri possibili, con rendimenti che oscillano a caso come sui mercati veri. La percentuale dice in quanti di questi futuri il patrimonio non si esaurisce prima della fine.",
            listOf("scenari simulati", "futuri possibili", "scenari"),
        ),
        AnalyticsGlossaryEntry(
            "probabilita-successo", "Probabilità di successo",
            "La quota di scenari simulati in cui il patrimonio dura fino all'ultimo anno. Sopra il 90% è solida; sotto il 75% in troppi casi finisce prima.",
            listOf("probabilità di successo"),
        ),
        AnalyticsGlossaryEntry(
            "regola-fissa", "Spesa fissa",
            "Spendi ogni anno la stessa cifra (corretta per l'inflazione), qualunque cosa faccia il mercato. È la regola più prevedibile ma anche la più fragile nei periodi brutti.",
            listOf("spesa fissa"),
        ),
        AnalyticsGlossaryEntry(
            "regola-percentuale", "Percentuale del patrimonio",
            "Ogni anno prelevi una percentuale di ciò che hai in quel momento. Il patrimonio non si esaurisce mai, ma la spesa sale e scende con il mercato.",
            listOf("percentuale del patrimonio"),
        ),
        AnalyticsGlossaryEntry(
            "regola-gk", "Guyton-Klinger",
            "Una regola con paletti: se il prelievo diventa troppo alto rispetto al patrimonio lo tagli del 10%, se è basso puoi alzarlo. Evita i tagli drastici ma richiede flessibilità.",
            listOf("guyton-klinger"),
        ),
        AnalyticsGlossaryEntry(
            "regola-vanguard", "Vanguard dinamica",
            "Prelievo di una percentuale del patrimonio, ma con un tetto e un minimo ai cambiamenti da un anno all'altro (circa ±5%). La spesa resta più stabile della pura percentuale.",
            listOf("vanguard dinamica", "vanguard"),
        ),
        AnalyticsGlossaryEntry(
            "imposte-latenti", "Imposte sulle plusvalenze",
            "Sui guadagni non ancora incassati pagheresti un'imposta (in genere 26%, 12,5% sui titoli di Stato) solo vendendo. Qui è la stima di quanto sarebbe se vendessi tutto oggi.",
            listOf("imposte sulle plusvalenze", "plusvalenze", "imposte latenti"),
        ),
        AnalyticsGlossaryEntry(
            "ter", "TER (costo del fondo)",
            "Il costo annuo di un fondo o ETF, in % del valore, già tolto dal rendimento. Lo trovi nel KID. Un ETF globale è di solito 0,1-0,4%. Piccolo ogni anno, pesa su orizzonti lunghi.",
            listOf("costo del fondo", "ter"),
        ),
        AnalyticsGlossaryEntry(
            "bollo", "Imposta di bollo",
            "Lo 0,2% annuo sul valore dei titoli in deposito. Si paga anche se non vendi. Per le crypto non si applica.",
            listOf("bollo"),
        ),
        AnalyticsGlossaryEntry(
            "erosione", "Erosione dei costi",
            "Quanto in meno avresti dopo molti anni, a parità di rendimento lordo, per effetto di costi e bollo che ogni anno sottraggono una piccola quota.",
            listOf("a parità di rendimento"),
        ),
        AnalyticsGlossaryEntry(
            "volatilita", "Volatilità",
            "Quanto il valore oscilla in un anno. Il 12% significa che di solito il portafoglio sale o scende fino a 12 punti rispetto alla media; più è alta, più il percorso è ballerino.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "peggior-calo", "Peggior calo (drawdown)",
            "La perdita più grande dal punto più alto al punto più basso successivo. Dice quanto male è andata nel peggior momento.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "sharpe", "Indice di Sharpe",
            "Il rendimento ottenuto per ogni unità di rischio corso. Sopra 1 è buono, sotto 0,5 il rischio è poco ripagato.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "sortino", "Indice di Sortino",
            "Come Sharpe, ma conta solo le oscillazioni al ribasso, che sono quelle che fanno male.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "calmar", "Indice di Calmar",
            "Rendimento annuo diviso per il peggior calo. Dice quanto rendimento ottieni per ogni punto di perdita massima sopportata.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "var", "VaR 95%",
            "Valore a rischio: nel 5% dei giorni peggiori si perde almeno questa percentuale in un giorno. Nel restante 95% la perdita è minore.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "cvar", "CVaR 95%",
            "La perdita media nei giorni peggiori (quel 5%). È più severa del VaR perché guarda come vanno i casi brutti.",
            listOf(),
        ),
        AnalyticsGlossaryEntry(
            "posizioni-effettive", "Posizioni effettive",
            "Quanti titoli equivalenti hai, tenendo conto dei pesi. 1 significa tutto su un titolo, più è alto più sei diversificato.",
            listOf(),
        ),
    )

    val explainers: List<AnalyticsExplainer> = listOf(
        AnalyticsExplainer(
            "fire-number", "Numero FIRE",
            what = "È il capitale che ti servirebbe per vivere con il solo rendimento del tuo patrimonio, senza più lavorare per reddito. Dipende da quanto spendi e da quanta parte del capitale accetti di prelevare ogni anno.",
            read = "Sopra il numero, con queste ipotesi sei già indipendente; sotto, la barra mostra quanto manca. Pochi decimi di tasso di prelievo spostano il traguardo di decine di migliaia di euro.",
            how = "Numero FIRE = spesa annua ÷ tasso di prelievo. Con il 3,5% e 30.000 € di spesa: 30.000 ÷ 0,035 ≈ 857.000 €. Se attivi le imposte latenti, il numero è diviso per (1 − quota di patrimonio che se ne andrebbe in imposte vendendo tutto), perché prelevando realizzi plusvalenze tassate. Gli anni mancanti si ricavano dalla crescita del patrimonio con il tuo risparmio annuo e il rendimento reale ipotizzato (tutto in euro di oggi, quindi già al netto dell'inflazione).",
            limits = "La spesa di oggi non è per forza quella futura (figli, casa, salute). Il tasso di prelievo non è una garanzia: descrive cosa sarebbe successo nel passato. Il rendimento futuro è incerto: per questo esiste la scheda Simulazione. Il patrimonio non sottrae i debiti: se hai un mutuo, le sue rate sono già dentro la spesa.",
            sources = listOf(AnalyticsExplainerSource("Bengen (1994), «Determining Withdrawal Rates Using Historical Data», Journal of Financial Planning", null), AnalyticsExplainerSource("Cooley, Hubbard, Walz (1998), «Retirement Savings: Choosing a Withdrawal Rate That Is Sustainable» (Trinity Study)", null), AnalyticsExplainerSource("Pfau (2010), «An International Perspective on Safe Withdrawal Rates» (per l'Italia il tasso sicuro storico risulta più basso che negli USA)", null)),
        ),
        AnalyticsExplainer(
            "sensitivity", "Sensibilità alle ipotesi",
            what = "Mostra quanti anni mancano al numero FIRE cambiando due ipotesi alla volta. Mostra quali ipotesi spostano di più il traguardo.",
            read = "Ogni cella è una combinazione. Guarda quanto cambiano gli anni spostandoti di una riga o di una colonna: se cambiano poco, quell'ipotesi pesa poco. Di solito spesa e risparmio pesano molto più del rendimento.",
            how = "Ogni cella ricalcola gli anni al traguardo con la stessa formula del numero FIRE. Nella tabella spesa/risparmio, spendere meno abbassa il traguardo e libera anche risparmio.",
            limits = "Cambiare una sola ipotesi per volta isola l'effetto, ma nella realtà rendimento e inflazione si muovono insieme.",
            sources = listOf(),
        ),
        AnalyticsExplainer(
            "coast", "Coast FIRE",
            what = "È il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE fra N anni. Se ce l'hai già puoi smettere di risparmiare per la pensione (e coprire solo le spese correnti).",
            read = "Confronta il tuo patrimonio con la cifra dell'orizzonte che ti interessa. Più l'orizzonte è lungo, più la cifra richiesta è bassa, perché il rendimento composto ha più tempo.",
            how = "Coast = numero FIRE ÷ (1 + rendimento reale)^anni.",
            limits = "Assume un rendimento costante, senza cali. Una sequenza sfavorevole può rendere insufficiente il Coast.",
            sources = listOf(),
        ),
        AnalyticsExplainer(
            "montecarlo", "Simulazione Monte Carlo",
            what = "Invece di un solo futuro «medio», genera migliaia di futuri possibili con rendimenti che oscillano a caso, e conta in quanti il patrimonio dura per tutta la pensione. Mostra il rischio che un calcolo con un solo rendimento nasconde.",
            read = "«Probabilità di successo» = quota di scenari in cui il patrimonio non si esaurisce prima della fine. Le fasce mostrano i casi sfortunati (10°), tipici (50°) e fortunati (90° percentile) per ogni anno. Una probabilità molto alta non è una garanzia; una più bassa dice di quanto margine hai.",
            how = "Ogni anno il rendimento reale è estratto da una distribuzione lognormale con la media e la volatilità che hai indicato (stesso risultato a ogni apertura: gli scenari casuali sono fissati da un seme). Nella fase di accumulo versi il risparmio annuo; poi preleli secondo la regola scelta. Tutto in euro di oggi.",
            limits = "Rendimenti indipendenti da un anno all'altro e distribuiti in modo regolare: la realtà ha code più pesanti e periodi lunghi di mercati deboli. Il risultato dipende molto da media e volatilità ipotizzate, che sono tue assunzioni, non previsioni. Non usa dati storici.",
            sources = listOf(AnalyticsExplainerSource("Guyton, Klinger (2006), «Decision Rules and Maximum Initial Withdrawal Rates», Journal of Financial Planning", null), AnalyticsExplainerSource("Kitces, «The Problem With Monte Carlo» e altri articoli su sequence of returns risk (kitces.com)", "https://www.kitces.com")),
        ),
        AnalyticsExplainer(
            "rules", "Regole di prelievo",
            what = "Come decidi quanto prelevare ogni anno cambia molto le probabilità di durare. Questa scheda confronta quattro regole sugli stessi scenari.",
            read = "Guarda due cose insieme: la probabilità di successo e quanto la spesa può calare nei casi sfortunati. Le regole flessibili reggono meglio ma ti chiedono di tagliare le spese quando i mercati scendono; la regola fissa non taglia mai ma è la più fragile.",
            how = "Fissa: la stessa spesa reale ogni anno. Percentuale: ogni anno una quota fissa del patrimonio. Guyton-Klinger (versione semplificata): spesa costante, ma dopo un anno negativo si salta l'adeguamento all'inflazione; se il tasso di prelievo sale oltre il 120% del tasso iniziale si taglia del 10%, se scende sotto l'80% si aumenta del 10% (il taglio non si applica negli ultimi 15 anni). Vanguard dinamica: prelievo pari al tasso iniziale sul patrimonio, ma con variazione annua limitata fra −2,5% e +5%.",
            limits = "Le soglie di Guyton-Klinger sono quelle della letteratura ma qui sono semplificate: non sostituiscono lo studio originale. Le regole sono confrontate sullo stesso modello di mercato, quindi valgono i limiti della simulazione. La regola a percentuale non può esaurire il patrimonio per costruzione: il suo prezzo è il taglio della spesa, per questo conta guardare entrambe le colonne.",
            sources = listOf(AnalyticsExplainerSource("Guyton, Klinger (2006), Journal of Financial Planning", null), AnalyticsExplainerSource("Vanguard, «Dynamic spending» (regola con soglie −2,5% / +5%)", null)),
        ),
        AnalyticsExplainer(
            "growth", "Da dove arriva la crescita",
            what = "Divide l'aumento del tuo patrimonio finanziario (liquidità + investimenti) in due parti: quanto hai risparmiato e quanto è venuto dal resto (mercati, interessi, rivalutazioni).",
            read = "Se la parte «risparmio» domina, la tua crescita dipende da quanto metti da parte, che puoi controllare. Se domina il «resto», dipende dai mercati. Un mese con il resto negativo non è una perdita tua: è il mercato che scende.",
            how = "Per ogni mese: variazione del patrimonio = entrate − uscite (risparmio) + resto. Il resto è la differenza, quindi include anche tutto ciò che non passa dai movimenti (regali, rimborsi, trasferimenti non registrati).",
            limits = "Il resto è una stima per differenza, non una misura diretta del rendimento (per quello c'è la scheda Rendimenti degli Investimenti). Lo storico della liquidità è ricostruito una volta sola: un conto aggiunto tardi, o investimenti registrati da poco, compaiono come un salto «da mercato» nel mese in cui entrano.",
            sources = listOf(),
        ),
        AnalyticsExplainer(
            "risk", "Rischio del portafoglio",
            what = "Misure di quanto il portafoglio oscilla e quanto può far male nei giorni peggiori, oltre a quanto ogni posizione pesa sul rischio totale.",
            read = "Sortino guarda solo le oscillazioni verso il basso (più alto è meglio). Calmar confronta il rendimento annuo con il peggior calo. VaR e CVaR dicono quanto si perde in un giorno brutto: il VaR è la soglia, il CVaR la perdita media oltre la soglia. Il contributo al rischio mostra se una posizione pesa sul rischio più di quanto pesi sul valore.",
            how = "Si usano i rendimenti giornalieri reali del tuo portafoglio nel periodo con dati. VaR/CVaR storici: il 5% dei giorni peggiori. Contributo al rischio: scomposizione di Eulero sulla matrice di covarianza (le quote sommano al 100%) tra le posizioni principali. Concentrazione: indice di Herfindahl (somma dei pesi al quadrato) e numero effettivo di posizioni = 1 ÷ indice.",
            limits = "Con meno di un anno di dati i numeri sono indicativi. Il passato non include crisi che non hai vissuto con questo portafoglio. VaR e CVaR giornalieri non dicono nulla sui cali lenti e lunghi.",
            sources = listOf(AnalyticsExplainerSource("Sortino & Price (1994), «Performance Measurement in a Downside Risk Framework», Journal of Investing", null)),
        ),
        AnalyticsExplainer(
            "costs", "Costi del portafoglio",
            what = "I costi ricorrenti (costo annuo dei fondi e bollo) sembrano piccoli ma, composti per decenni, erodono una parte importante del capitale.",
            read = "Il costo annuo in % mostra quanto paghi ogni anno. Il grafico mostra quanto capitale perderesti nel tempo rispetto allo stesso portafoglio senza costi. Inserisci il costo (TER) dei tuoi fondi per avere un numero completo.",
            how = "Costo annuo = valore × TER + valore × 0,2% di bollo (per le posizioni in deposito titoli). L'erosione confronta valore × (1 + rendimento)^anni con valore × (1 + rendimento − costo)^anni.",
            limits = "Il TER lo inserisci tu: se manca, il costo mostrato è un minimo. Non include commissioni di acquisto/vendita né costi interni non dichiarati (spread, tracking difference). Il bollo vale per chi ha un deposito titoli in Italia; con altri regimi può non applicarsi.",
            sources = listOf(),
        ),
        AnalyticsExplainer(
            "liquidation", "Se vendessi tutto oggi",
            what = "Il valore del patrimonio dopo le imposte che pagheresti realizzando tutte le plusvalenze. Il patrimonio «vero» da spendere è questo, non il valore di mercato.",
            read = "La differenza è l'imposta latente. Serve a non sopravvalutare quanto sei vicino al traguardo.",
            how = "Per ogni posizione in guadagno: plusvalenza non realizzata × aliquota (26%, 12,5% per i titoli di Stato; le perdite non vengono compensate).",
            limits = "Stima semplificata: non considera lo zaino fiscale, la compensazione tra posizioni, né il fatto che venderesti in anni diversi (frazionando le vendite si può pagare diversamente). Le regole fiscali sono quelle già usate nella scheda Tasse degli Investimenti.",
            sources = listOf(),
        ),
    )

    val walkthrough: List<AnalyticsWalkthroughStep> = listOf(
        AnalyticsWalkthroughStep(
            "Quattro domande, una risposta ciascuna",
            listOf(
                "Analitiche è la parte di Buddy Budget per chi vuole ragionare sui numeri. In alto vedi l'anno in cui puoi smettere di lavorare e quattro cursori per provare «e se…»; sotto, quattro schede rispondono ciascuna a una domanda con una frase e un grafico.",
                "Ogni risultato è una stima basata su ipotesi che decidi tu. Non è una previsione e non è una consulenza: mostra quali scelte contano di più.",
            ),
        ),
        AnalyticsWalkthroughStep(
            "Quanta strada ho fatto?",
            listOf(
                "Il numero FIRE è il capitale che ti servirebbe per vivere con il solo patrimonio: la spesa annua divisa per il tasso di prelievo, al netto delle imposte sulle plusvalenze se lo scegli.",
                "Qui vedi quanto ne hai già e da dove è arrivata la crescita degli ultimi 12 mesi: dal tuo risparmio o dal mercato.",
            ),
        ),
        AnalyticsWalkthroughStep(
            "Quando posso smettere di lavorare?",
            listOf(
                "Il grafico mostra come sale il patrimonio fino al numero FIRE e l'anno in cui lo raggiungi; la linea tratteggiata è il percorso con le ipotesi salvate, per vedere cosa cambia muovendo i cursori.",
                "Se un'ipotesi cambia molto la data, fidati meno del risultato.",
            ),
        ),
        AnalyticsWalkthroughStep(
            "Il patrimonio reggerà?",
            listOf(
                "Un calcolo con un solo rendimento «medio» nasconde il rischio. La simulazione genera migliaia di futuri possibili e conta in quanti il patrimonio dura fino alla fine della pensione.",
                "Vedi anche come cambia la risposta con quattro modi di prelevare. Rischio e dettagli stanno in «Per esperti».",
            ),
        ),
        AnalyticsWalkthroughStep(
            "Quanto mi costa il portafoglio?",
            listOf(
                "Costi dei fondi e bollo, quanto erodono nel tempo e quanta imposta pagheresti vendendo tutto oggi. Il costo dei fondi (TER) lo inserisci tu in «Per esperti».",
            ),
        ),
        AnalyticsWalkthroughStep(
            "Le ipotesi e «Per esperti»",
            listOf(
                "I cursori (risparmio, spesa, rendimento, prelievo) provano un'ipotesi senza salvarla: l'anno e le risposte si aggiornano subito e ti dicono quanto guadagni o perdi rispetto a quelle salvate. «Salva queste ipotesi» le rende definitive, «Ripristina» le annulla. Spesa, risparmio e rendimento, se non li hai scritti tu, vengono dai tuoi dati del periodo che scegli sopra i cursori (ultimi 12 mesi, 24 o mesi a scelta); le altre ipotesi sono in «Tutte le ipotesi».",
                "In fondo a ogni domanda, «Per esperti» apre l'analisi completa con la guida passo passo, la formula e i limiti. Puoi riaprire questa guida dal pulsante «Guida».",
            ),
        ),
    )

    fun term(id: String): AnalyticsGlossaryEntry? = glossary.firstOrNull { it.id == id }
    fun explainer(id: String): AnalyticsExplainer? = explainers.firstOrNull { it.id == id }
}
