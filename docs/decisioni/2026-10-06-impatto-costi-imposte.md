# Costi e imposte nel Portafoglio

Data: 2026-10-06

Sezione espandibile nella card esistente: commissioni e imposte effettivamente registrate, nel periodo del grafico e dall’inizio.
Confronto TWR degli stessi titoli e prezzi rimuovendo gli addebiti del periodo; prima l’effetto dei costi, poi quello delle imposte, con somma in punti percentuali. Nessuna doppia sottrazione o reinvestimento simulato.
Importi già in valuta utente, rimborsi con segno conservato; escluse operazioni future e rettifiche non monetarie. Impatto nascosto senza valorizzazione sufficiente.
Gli oneri autonomi del conto broker, il TER e le imposte stimate/non registrate sono esclusi e dichiarati in UI: integrarli richiede riconciliazione con gli oneri già attribuiti alle operazioni e uno storico cash completo.
Verifica con fixture sintetiche e browser locale; nessuna modifica ai saldi o ai dati importati. Feature su branch locale distinto dalla PR di navigazione.
