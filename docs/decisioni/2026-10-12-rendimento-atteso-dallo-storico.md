# Analitiche: rendimento atteso dallo storico, cursore fino al 50%

Data: 2026-10-12

- Il rendimento reale di Analitiche parte, di default, da quello che il portafoglio ha fatto davvero: ultimi 24 mesi se lo storico li copre (15 giorni di tolleranza), altrimenti 12, altrimenti il 4% prudente di prima. È time-weighted e annualizzato (versamenti e prelievi non contano come guadagno, stesso calcolo della pagina Investimenti), poi tolta l'inflazione osservata nel periodo o, se l'indice non lo copre, quella delle ipotesi.
- Nessun numero sotto 1.000 € investiti, con meno di 12 mesi di storico o con titoli senza prezzo (sembrerebbero perdite): resta il valore prudente e la riga sotto il cursore dice perché.
- Nuovo campo `expectedReturnAuto` nelle ipotesi (JSON, nessuna migration): vero di default; chi aveva salvato un rendimento diverso dal 4% resta sul suo. Salvare un rendimento lo rende manuale; «Usa il tuo rendimento» torna all'automatico.
- Cursore e limiti da −2% a 50%; sopra l'8% reale compare un avviso (le borse mondiali hanno reso in media intorno al 5% reale nel lungo periodo), senza bloccare.
- Osservabilità: log `analytics.return_source.changed`, eventi Umami `analytics_return_source_shown` e `analytics_return_source_changed`.
- Rimandato: usare il money-weighted al posto del time-weighted. La finestra si sceglie dal 2026-10-12 (`2026-10-12-analitiche-periodo-dei-dati.md`).
