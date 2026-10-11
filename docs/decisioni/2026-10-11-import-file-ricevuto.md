# Import personale: schermata «File ricevuto» (2026-10-11)

Dopo l'invio di un CSV personale il modulo restava a video e l'avanzamento compariva in cima alla pagina, fuori vista: non si capiva che il file era in lista e in elaborazione. Ora il modulo viene sostituito da «File ricevuto»: nome, banca, peso e righe del file, le quattro fasi (ricevuto, analisi, salvataggio, importato) dallo stato vero del lavoro, a fine lavoro il conteggio di movimenti e operazioni creati con i link ai dati, «Vedi le tue importazioni» e «Carica un altro file». L'elenco espone solo i conteggi del registro, mai gli id. Nell'import investimenti il riepilogo finale rimanda a «Gestisci importazioni».
Rimandati: avanzamento a contatori reali (il lavoro è una coda con stima, non ha contatori), elenco delle righe scartate nel riepilogo.

## Scelta C (stesso giorno)
Dopo i mockup (`importazioni-redesign`) Daniele ha scelto C: lavoro in background con indicatore globale. L'isola `PersonalImportIsland` (stesso stile e pila di quella dei sync) mostra in ogni pagina i file in elaborazione e, a fine lavoro, l'esito con i conteggi e il link al dettaglio; la chiusura si ricorda su questo dispositivo (localStorage). Il polling della lista parte solo mentre c'è un'importazione in corso. La pagina `/importazioni?job=…` mostra il rapporto del file (stessa schermata «File ricevuto»). Il consenso all'AI resta un passo del modulo (3 passi, non 2).
Rimandati: stessa isola per l'import investimenti (oggi sincrono), eliminazione dal rapporto (resta in «Gestisci importazioni»), elenco scaricabile delle righe escluse.
