/**
 * Testi esplicativi delle analitiche. Ogni analitica ha lo stesso schema: che cosa significa, come leggerla, come è
 * calcolata, quali limiti ha e da dove viene il metodo. Servono a evitare numeri "buttati lì" senza spiegazione.
 */

export interface ExplainerSource {
  label: string;
  /** Link solo quando verificato; altrimenti la sola citazione bibliografica. */
  url?: string;
}

export interface ExplainerContent {
  title: string;
  what: string;
  read: string;
  how: string;
  limits: string;
  sources?: ExplainerSource[];
}

export const EXPLAINERS = {
  "fire-number": {
    title: "Numero FIRE",
    what: "È il capitale che ti servirebbe per vivere con il solo rendimento del tuo patrimonio, senza più lavorare per reddito. Dipende da quanto spendi e da quanta parte del capitale accetti di prelevare ogni anno.",
    read: "Se il tuo patrimonio è sopra il numero, secondo queste ipotesi sei già indipendente; se è sotto, la barra mostra quanta strada manca. Cambia le ipotesi in alto per vedere quanto il numero è sensibile: pochi decimi di tasso di prelievo spostano il traguardo di decine di migliaia di euro.",
    how: "Numero FIRE = spesa annua ÷ tasso di prelievo. Con il 3,5% e 30.000 € di spesa: 30.000 ÷ 0,035 ≈ 857.000 €. Se attivi le imposte latenti, il numero è diviso per (1 − quota di patrimonio che se ne andrebbe in imposte vendendo tutto), perché prelevando realizzi plusvalenze tassate. Gli anni mancanti si ricavano dalla crescita del patrimonio con il tuo risparmio annuo e il rendimento reale ipotizzato (tutto in euro di oggi, quindi già al netto dell'inflazione).",
    limits: "La spesa di oggi non è per forza quella futura (figli, casa, salute). Il tasso di prelievo non è una garanzia: descrive cosa sarebbe successo nel passato. Il rendimento futuro è incerto: per questo esiste la scheda Simulazione. Il patrimonio non sottrae i debiti: se hai un mutuo, le sue rate sono già dentro la spesa.",
    sources: [
      { label: "Bengen (1994), «Determining Withdrawal Rates Using Historical Data», Journal of Financial Planning" },
      { label: "Cooley, Hubbard, Walz (1998), «Retirement Savings: Choosing a Withdrawal Rate That Is Sustainable» (Trinity Study)" },
      { label: "Pfau (2010), «An International Perspective on Safe Withdrawal Rates» (per l'Italia il tasso sicuro storico risulta più basso che negli USA)" },
    ],
  },
  sensitivity: {
    title: "Sensibilità alle ipotesi",
    what: "Mostra quanti anni mancano al numero FIRE cambiando due ipotesi alla volta. Serve a capire quali ipotesi contano davvero e quali no.",
    read: "Ogni cella è una combinazione. Guarda quanto cambiano gli anni spostandoti di una riga o di una colonna: se cambiano poco, quell'ipotesi pesa poco. Di solito spesa e risparmio pesano molto più del rendimento.",
    how: "Ogni cella ricalcola gli anni al traguardo con la stessa formula del numero FIRE. Nella tabella spesa/risparmio, spendere meno abbassa il traguardo e libera anche risparmio.",
    limits: "Cambiare una sola ipotesi per volta isola l'effetto, ma nella realtà rendimento e inflazione si muovono insieme.",
  },
  coast: {
    title: "Coast FIRE",
    what: "È il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE fra N anni. Se ce l'hai già puoi smettere di risparmiare per la pensione (e coprire solo le spese correnti).",
    read: "Confronta il tuo patrimonio con la cifra dell'orizzonte che ti interessa. Più l'orizzonte è lungo, più la cifra richiesta è bassa, perché il rendimento composto ha più tempo.",
    how: "Coast = numero FIRE ÷ (1 + rendimento reale)^anni.",
    limits: "Assume un rendimento costante, senza cali. Una sequenza sfavorevole può rendere insufficiente il Coast.",
  },
  montecarlo: {
    title: "Simulazione Monte Carlo",
    what: "Invece di un solo futuro «medio», genera migliaia di futuri possibili con rendimenti che oscillano a caso, e conta in quanti il patrimonio dura per tutta la pensione. Mostra il rischio che un calcolo con un solo rendimento nasconde.",
    read: "«Probabilità di successo» = quota di scenari in cui il patrimonio non si esaurisce prima della fine. Le fasce mostrano i casi sfortunati (10°), tipici (50°) e fortunati (90° percentile) per ogni anno. Una probabilità molto alta non è una garanzia; una più bassa dice di quanto margine hai.",
    how: "Ogni anno il rendimento reale è estratto da una distribuzione lognormale con la media e la volatilità che hai indicato (stesso risultato a ogni apertura: gli scenari casuali sono fissati da un seme). Nella fase di accumulo versi il risparmio annuo; poi preleli secondo la regola scelta. Tutto in euro di oggi.",
    limits: "Rendimenti indipendenti da un anno all'altro e distribuiti in modo regolare: la realtà ha code più pesanti e periodi lunghi di mercati deboli. Il risultato dipende molto da media e volatilità ipotizzate, che sono tue assunzioni, non previsioni. Non usa dati storici.",
    sources: [
      { label: "Guyton, Klinger (2006), «Decision Rules and Maximum Initial Withdrawal Rates», Journal of Financial Planning" },
      { label: "Kitces, «The Problem With Monte Carlo» e altri articoli su sequence of returns risk (kitces.com)", url: "https://www.kitces.com" },
    ],
  },
  rules: {
    title: "Regole di prelievo",
    what: "Come decidi quanto prelevare ogni anno cambia molto le probabilità di durare. Questa scheda confronta quattro regole sugli stessi scenari.",
    read: "Guarda due cose insieme: la probabilità di successo e quanto la spesa può calare nei casi sfortunati. Le regole flessibili reggono meglio ma ti chiedono di tagliare le spese quando i mercati scendono; la regola fissa non taglia mai ma è la più fragile.",
    how: "Fissa: la stessa spesa reale ogni anno. Percentuale: ogni anno una quota fissa del patrimonio. Guyton-Klinger (versione semplificata): spesa costante, ma dopo un anno negativo si salta l'adeguamento all'inflazione; se il tasso di prelievo sale oltre il 120% del tasso iniziale si taglia del 10%, se scende sotto l'80% si aumenta del 10% (il taglio non si applica negli ultimi 15 anni). Vanguard dinamica: prelievo pari al tasso iniziale sul patrimonio, ma con variazione annua limitata fra −2,5% e +5%.",
    limits: "Le soglie di Guyton-Klinger sono quelle della letteratura ma qui sono semplificate: non sostituiscono lo studio originale. Le regole sono confrontate sullo stesso modello di mercato, quindi valgono i limiti della simulazione. La regola a percentuale non può esaurire il patrimonio per costruzione: il suo prezzo è il taglio della spesa, per questo conta guardare entrambe le colonne.",
    sources: [
      { label: "Guyton, Klinger (2006), Journal of Financial Planning" },
      { label: "Vanguard, «Dynamic spending» (regola con soglie −2,5% / +5%)" },
    ],
  },
  growth: {
    title: "Da dove arriva la crescita",
    what: "Divide l'aumento del tuo patrimonio finanziario (liquidità + investimenti) in due parti: quanto hai risparmiato e quanto è venuto dal resto (mercati, interessi, rivalutazioni).",
    read: "Se la parte «risparmio» domina, la tua crescita dipende da quanto metti da parte, che puoi controllare. Se domina il «resto», dipende dai mercati. Un mese con il resto negativo non è una perdita tua: è il mercato che scende.",
    how: "Per ogni mese: variazione del patrimonio = entrate − uscite (risparmio) + resto. Il resto è la differenza, quindi include anche tutto ciò che non passa dai movimenti (regali, rimborsi, trasferimenti non registrati).",
    limits: "Il resto è una stima per differenza, non una misura diretta del rendimento (per quello c'è la scheda Rendimenti degli Investimenti). Lo storico della liquidità è ricostruito una volta sola: un conto aggiunto tardi, o investimenti registrati da poco, compaiono come un salto «da mercato» nel mese in cui entrano.",
  },
  risk: {
    title: "Rischio del portafoglio",
    what: "Misure di quanto il portafoglio oscilla e quanto può far male nei giorni peggiori, oltre a quanto ogni posizione pesa sul rischio totale.",
    read: "Sortino guarda solo le oscillazioni verso il basso (più alto è meglio). Calmar confronta il rendimento annuo con il peggior calo. VaR e CVaR dicono quanto si perde in un giorno brutto: il VaR è la soglia, il CVaR la perdita media oltre la soglia. Il contributo al rischio mostra se una posizione pesa sul rischio più di quanto pesi sul valore.",
    how: "Si usano i rendimenti giornalieri reali del tuo portafoglio nel periodo con dati. VaR/CVaR storici: il 5% dei giorni peggiori. Contributo al rischio: scomposizione di Eulero sulla matrice di covarianza (le quote sommano al 100%) tra le posizioni principali. Concentrazione: indice di Herfindahl (somma dei pesi al quadrato) e numero effettivo di posizioni = 1 ÷ indice.",
    limits: "Con meno di un anno di dati i numeri sono indicativi. Il passato non include crisi che non hai vissuto con questo portafoglio. VaR e CVaR giornalieri non dicono nulla sui cali lenti e lunghi.",
    sources: [{ label: "Sortino & Price (1994), «Performance Measurement in a Downside Risk Framework», Journal of Investing" }],
  },
  costs: {
    title: "Costi del portafoglio",
    what: "I costi ricorrenti (costo annuo dei fondi e bollo) sembrano piccoli ma, composti per decenni, erodono una parte importante del capitale.",
    read: "Il costo annuo in % mostra quanto paghi ogni anno. Il grafico mostra quanto capitale perderesti nel tempo rispetto allo stesso portafoglio senza costi. Inserisci il costo (TER) dei tuoi fondi per avere un numero completo.",
    how: "Costo annuo = valore × TER + valore × 0,2% di bollo (per le posizioni in deposito titoli). L'erosione confronta valore × (1 + rendimento)^anni con valore × (1 + rendimento − costo)^anni.",
    limits: "Il TER lo inserisci tu: se manca, il costo mostrato è un minimo. Non include commissioni di acquisto/vendita né costi interni non dichiarati (spread, tracking difference). Il bollo vale per chi ha un deposito titoli in Italia; con altri regimi può non applicarsi.",
  },
  liquidation: {
    title: "Se vendessi tutto oggi",
    what: "Il valore del patrimonio dopo le imposte che pagheresti realizzando tutte le plusvalenze. Il patrimonio «vero» da spendere è questo, non il valore di mercato.",
    read: "La differenza è l'imposta latente. Serve a non sopravvalutare quanto sei vicino al traguardo.",
    how: "Per ogni posizione in guadagno: plusvalenza non realizzata × aliquota (26%, 12,5% per i titoli di Stato; le perdite non vengono compensate).",
    limits: "Stima semplificata: non considera lo zaino fiscale, la compensazione tra posizioni, né il fatto che venderesti in anni diversi (frazionando le vendite si può pagare diversamente). Le regole fiscali sono quelle già usate nella scheda Tasse degli Investimenti.",
  },
} as const satisfies Record<string, ExplainerContent>;

export type ExplainerId = keyof typeof EXPLAINERS;
