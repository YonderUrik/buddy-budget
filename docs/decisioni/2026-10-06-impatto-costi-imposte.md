# Costi e imposte nel Portafoglio

Data: 2026-10-06

Interruttori indipendenti accanto al grafico e card distinta per costi registrati, imposte registrate, stima aggiuntiva e totale, con link alla scheda Tasse.
`investmentTaxReport` è condivisa da Portafoglio e `buildTaxView`: stessi dati, aliquote, regime e compensazioni delle minusvalenze; nessun secondo motore fiscale. Il residuo annuale della stima dopo le ritenute registrate evita il doppio conteggio.
La simulazione reinveste gli oneri registrati esclusi dal giorno di addebito ai rendimenti giornalieri osservati. Le imposte stimate aggiuntive vengono invece sottratte quando il toggle imposte è attivo. Nell’amministrato sono distribuite sulle vendite secondo il report; per dichiarativo/crypto si collocano a fine anno (oggi per l’anno aperto), senza rappresentare la data effettiva del versamento fiscale.
Il Portafoglio carica tutti i prezzi per mantenere identico il valore simulato cambiando periodo. Senza portafoglio investito il risparmio resta liquido. Mancando valorizzazione la simulazione è disabilitata; nessuna modifica ai saldi salvati.
Oneri autonomi del broker e TER non registrati esclusi; bollo separato nella tab Tasse ed esplicitamente escluso qui. Test di parità fra le viste, perdite, minusvalenze pregresse, aliquote personalizzate, reinvestimento e quattro combinazioni degli interruttori.
