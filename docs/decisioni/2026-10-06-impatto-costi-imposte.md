# Simulazione senza costi e imposte nel Portafoglio

Data: 2026-10-06

Due interruttori indipendenti nella card esistente, inizialmente attivi: disattivando costi o imposte registrati si aggiornano valore e grafico simulati. Rimossi tabella e testo esplicativo esteso su richiesta dell’utente.
Ogni addebito risparmiato viene reinvestito alla chiusura della propria data e cresce ai rendimenti giornalieri osservati del portafoglio nei giorni successivi, mantenendo identiche le operazioni reali. Senza portafoglio investito il risparmio resta liquido.
La simulazione parte sempre dal primo investimento, indipendentemente dal periodo visibile. Flussi investiti e posizioni effettive restano invariati; i rimborsi hanno segno opposto. Nessuna modifica ai saldi salvati.
Sono inclusi solo gli oneri registrati sulle operazioni (valuta utente); oneri autonomi del broker, TER e imposte non registrate restano fuori dal perimetro. Mancando la valorizzazione la simulazione è disabilitata.
Test dei quattro stati, reinvestimento, indipendenza dal periodo, rimborsi, liquidazione completa e date future. Feature su branch locale distinto dalla PR di navigazione.
