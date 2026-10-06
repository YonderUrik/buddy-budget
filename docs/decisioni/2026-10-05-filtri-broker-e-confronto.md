# Filtri broker e confronto dei rendimenti

Data: 2026-10-05

Richiesti sia inclusione/esclusione dei broker dal portafoglio combinato sia sovrapposizione dei rendimenti. Filtro temporaneo condiviso tra le schede Investimenti: non elimina import e non cambia patrimonio generale, cassa o sidebar; si azzera ricaricando/uscendo dalla sezione. Origine ricavata dalla chiave del broker anche nello stesso portafoglio; righe legacy dedicate riconosciute, altre manuali/import precedenti separate. Confronto in percentuale TWR con date reali e linea combinata ricalcolata, mai somma dei rendimenti. Eventi Umami per selezione e overlay, nessuna scrittura finanziaria o migration.

Il Portafoglio mostra anche titoli + liquidità dei conti broker collegati, inclusi saldi negativi e conti senza operazioni. I collegamenti vengono deduplicati per conto e filtrati per broker.
La liquidità resta già conteggiata nel patrimonio generale: nessuna modifica ai calcoli globali. Grafici e rendimenti restano dei soli titoli; il cash riporta la data dell’ultimo rendiconto, senza simulare aggiornamenti in tempo reale.

Aggiornamento 2026-10-06: su richiesta dell’utente il cash si attiva con «Includi liquidità» nella card Portafoglio esistente, senza riquadro aggiuntivo. Attivo inizialmente; spento mostra solo titoli, senza cambiare saldi salvati o grafici.
