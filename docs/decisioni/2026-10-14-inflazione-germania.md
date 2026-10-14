# Germania: prima fase, rendimenti al netto dell'inflazione

Abilitare una funzione per volta, dopo localizzazione, test e prova locale. Questa fase riguarda solo l'inflazione; fiscalità, previdenza, previsioni dei proventi e FIRE restano bloccati per DE.

## Implementazione

- Registro finanziario per paese, indipendente dalla lingua: Italia usa IT, Germania DE; entrambe soltanto in EUR. Paesi o valute non supportati non ricevono un indice di un altro paese. Il cron aggiorna tutte le aree del registro e riporta i conteggi per area; i log distinguono l'area nel campo `reason`.
- Eurostat ha sostituito `prc_hicp_midx` (2015=100) con `prc_hicp_minr` (2025=100), classificazione ECOICOP v2. Richieste esplicite: frequenza M, unità I25, coicop18 TOTAL e area nazionale. Il provider verifica le dimensioni della risposta.
- `source` identifica dataset, base e voce. Un cambio di serie richiede lo storico completo dal gennaio 2000 e sostituisce l'area in una transazione. Nessuna combinazione di basi diverse; nessuna modifica dei movimenti. Errori o risposte vuote conservano i dati precedenti. I lettori espongono soltanto la nuova serie compatibile: fino al primo aggiornamento riuscito, il valore reale è indisponibile, non calcolato da dati misti.
- Aggiornamenti successivi ricaricano gli ultimi 36 mesi, mantenendo lo storico. La UI indica paese e ultimo mese disponibile, in italiano, inglese e tedesco. Cache client separata per paese.
- Formula invariata: (1 + rendimento nominale) / (1 + inflazione) - 1. HICP nazionale come misura della variazione del potere d'acquisto; non indice di spesa personale né previsione.

## Fonti verificate il 14 ottobre 2026

- https://ec.europa.eu/eurostat/web/hicp/information-data
- https://webgate.ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm
- https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=DE&coicop18=TOTAL&unit=I25&freq=M&sinceTimePeriod=2000-01

Verifica reale: IT e DE hanno restituito 321 osservazioni, gennaio 2000–settembre 2026. Dati caricati soltanto nel database locale isolato. Nessuna migration strutturale richiesta.

## Verifica in produzione dopo l'approvazione

Attendere il cron prezzi e controllare `inflationByArea` e `market.inflation.updated` per IT e DE; verificare il rendimento reale con paese Germania in inglese e tedesco, poi Italia in inglese e italiano. Dati assenti devono produrre un messaggio esplicito, senza ripiego sull'Italia. Pensione, tasse, proventi e Analitiche tedeschi restano non accessibili. Nessun merge/deploy incluso nella prova locale.

## Fasi successive

2. Costi degli investimenti senza ipotesi fiscali italiane.
3. Fiscalità di base degli investimenti, versionata per anno.
4. Fiscalità specifica di fondi ed ETF.
5. Previsioni dei proventi, prima lordi poi netti.
6. Registrazione dei prodotti pensionistici e separazione fra capitale ed entrate future.
7. Proiezioni pensionistiche specifiche per prodotto.
8. Pianificazione pensionamento/FIRE con i modelli già verificati.
9. Crypto e casi fiscali speciali, ciascuno con il proprio ambito di supporto.

Ogni fase: fonti ufficiali, logica per paese, traduzioni DE/EN, regressioni IT, prova localhost, PR separata, approvazione ed abilitazione.

## Esito verifica locale

Build produzione e TypeScript riusciti. 55 test mirati superati, inclusi rollback transazionale e invarianza del rendimento al cambio di base; 3 test screenshot superati. Suite completa: 2.217 test superati e il solo errore noto del logger legato a `/Users/mario`; i due test aggiunti successivamente sono inclusi nei 55 mirati. Browser: quattro combinazioni paese/lingua, valori nazionali verificati nelle API, rendimento reale presente, spiegazione col paese corretto, blocchi tedeschi ancora attivi, nessun errore browser. Screenshot Performance aggiornati nei due temi. Preview lasciata in DE/en.
