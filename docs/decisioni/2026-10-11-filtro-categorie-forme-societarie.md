# Filtro AI: preservare il riconoscimento delle società

- Il filtro riconosce la forma societaria finale nel testo prima che l'estrazione la rimuova: «DB Vertrieb GmbH» non diventa più un falso nome di persona.
- All'AI continua ad arrivare soltanto il nome ripulito. Il blocco di bonifici e altre operazioni mantiene la precedenza, e i nomi di persone senza indicazioni di attività restano bloccati.
- Aggiunti test di regressione per società, nomi di persone e bonifici verso società. Nessuna modifica grafica, nessun impatto sulla landing; nessun nuovo segnale di osservabilità o richiesta esterna aggiuntiva per elemento.
- Restano rimandati i retry e la distinzione visibile fra errori e proposte assenti; questa correzione riguarda il falso positivo del filtro.
