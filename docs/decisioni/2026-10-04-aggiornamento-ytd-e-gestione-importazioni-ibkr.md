# Aggiornamento YTD e gestione importazioni IBKR

Data: 2026-10-04

Su richiesta dell'utente, nuovi CSV sostituiscono i periodi interamente coperti in una transazione; anteprima esplicita e riconciliazione dei periodi successivi. Gli overlap parziali richiedono un export completo per non inventare snapshot intermedi. Da Rendiconti si gestiscono ed eliminano gli import: rimuovere un periodo richiede conferma dell'elenco dei successivi dipendenti, verificato sotto lock. Saldo ripristinato all'ultima chiusura conservata; catalogo/prezzi mantenuti. Nessun push o PR.
