# Import Trade Republic

In Investimenti → Importa, scegli Trade Republic e carica `Transaction export.csv`. Il formato viene riconosciuto dalle intestazioni anche senza selezionare il provider. Funziona anche nella selezione multipla e con file contenenti solo movimenti del conto.

Carica lo storico completo del conto principale (`account_type=DEFAULT`). Il formato non fornisce un numero di conto: una sola fonte Trade Republic per utente. I successivi export devono coprire tutti i periodi già caricati. Un file identico non genera duplicati.

- BUY/SELL di STOCK, FUND e CRYPTO diventano operazioni di investimento, con quantità frazionarie, prezzo di esecuzione, commissioni e tasse. Gli strumenti sono abbinati per ISIN o simbolo crypto e valuta.
- Tutte le righe CASH diventano movimenti del conto dedicato, compresi carta nazionale/internazionale, rimborsi, bonifici, interessi, bonus, regali e rettifiche fiscali. Sono inizialmente da categorizzare. Importo netto = `amount + fee + tax`, con i segni dell'export. La valuta originale di un pagamento estero non viene conteggiata una seconda volta.
- Le righe `DELIVERY` / `FREE_RECEIPT` (crypto ricevute gratis: staking settimanale o trasferimenti in ingresso) diventano acquisti al prezzo di mercato del giorno indicato nel file, senza movimenti di cassa; l'anteprima mostra un avviso con il conteggio. Solo per `CRYPTO`, con quantità e prezzo positivi.
- `date` è la data contabile: può precedere `datetime` anche di mesi (imposte sullo staking addebitate in ritardo), mai seguirlo di oltre un giorno.
- Il saldo deriva da tutte le componenti di cassa, inclusi acquisti e vendite; queste ultime non vengono duplicate tra le spese. Il CSV non contiene un saldo ufficiale né una valorizzazione delle posizioni: saldo iniziale assunto zero, nessuna riconciliazione certificata.
- Si conserva la data contabile `date` anche quando `datetime` UTC cade nel giorno adiacente. Le righe originali, inclusi riferimenti, cambio e controparte, restano nel rendiconto salvato.
- L'aggiornamento avviene in una transazione unica. I movimenti sono identificati da `transaction_id`; note e categorizzazioni sopravvivono all'aggiornamento. Eliminazione dell'import e ripristino dello storico eliminano anche i movimenti di cassa importati.

Errori strutturali, ID duplicati, date future, classi o operazioni TRADING sconosciute bloccano il file intero. Nessuno scarto silenzioso. Limiti: 5 MB, 5000 righe, 50 strumenti. Per formati diversi o eventi su titoli ulteriori servirà un nuovo esempio di export.

Verifica effettuata sul file locale fornito: 885 righe = 17 operazioni di investimento + 868 movimenti di cassa, 6 strumenti, nessun errore nel controllo delle quantità. Il CSV personale non è copiato nel repository. I test versionati usano esclusivamente dati sintetici e coprono anche reimportazione, aggiornamento e cancellazione su Postgres locale.
