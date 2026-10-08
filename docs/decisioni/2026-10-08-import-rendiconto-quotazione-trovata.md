# Import da rendiconto: quotazione collegata in automatico (2026-10-08)

Nel passo «Strumenti» dell'import di un rendiconto (IBKR, DEGIRO, Trade Republic) gli strumenti con ISIN nascono con i prezzi automatici se OpenFIGI + Yahoo trovano una quotazione nella valuta del file (stessa verifica di «Cerca la quotazione»); la riga è «Da controllare» e si può cambiare nel passo. Se non c'è quotazione, o le fonti non rispondono, restano manuali con i prezzi del broker come prima. Cambia la scelta precedente («manuale finché non si collega a mano»), su richiesta dell'utente. I prezzi del rendiconto restano salvati.
Impatto landing: nessuno. Osservabilità: nessun nuovo segnale (riusa la ricerca per ISIN già tracciata).
