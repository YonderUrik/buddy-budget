# Importazioni più compatte e spiegate (2026-10-09)

Nella scheda Operazioni di Investimenti la sezione Importazioni passa in fondo alla pagina, dopo le operazioni, con una spiegazione sempre visibile (cosa sono, come aggiornare un periodo) e l'elenco chiuso di default («Vedi e gestisci i file caricati», con riepilogo). Dentro l'elenco una frase spiega cosa fa «Elimina» (annulla l'importazione) e restano le opzioni avanzate. Nessun cambio ai dati né alle API. Scartato: eliminare la sezione, perché è l'unico punto per annullare un import.

Stessa PR: la pagina «I tuoi CSV» (`/importazioni`) passa allo stile della Panoramica: sezioni aperte con icona tinta (Carica un file, Le tue importazioni, analisi in corso, dettaglio), niente riquadri, elenco a righe con stato a pallino e una spiegazione di come funziona in testa. Logica e API invariate.

Seconda passata su «I tuoi CSV»: un percorso in quattro passi in testa (carichi, analizziamo, controlliamo, trovi i dati) con il passo in corso evidenziato in base allo stato dell'importazione attiva, che si seleziona da sola se ce n'è una in corso; a importazione completata compaiono i link a Liquidità e alle operazioni. Componente `components/domain/personal-import`.
