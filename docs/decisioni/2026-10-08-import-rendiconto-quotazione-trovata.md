# Import da rendiconto: avviso sulla quotazione trovata (2026-10-08)

Nel passo «Strumenti» dell'import di un rendiconto (IBKR, DEGIRO, Trade Republic) gli strumenti con ISIN restano manuali con i prezzi del broker, come deciso. Ora la riga dice anche se OpenFIGI + Yahoo hanno trovato una quotazione nella valuta del file («quotazione trovata: SWDA.MI, collegabile dopo l'import da «Cerca la quotazione»») oppure «nessuna quotazione trovata». Se la fonte non risponde, la riga resta com'era. Il collegamento automatico durante l'import non c'è: resta un'azione esplicita dell'utente dalla pagina del titolo.
Impatto landing: nessuno. Osservabilità: nessun nuovo segnale (riusa la ricerca per ISIN già tracciata).
