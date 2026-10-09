# Importa operazioni: nuovo flusso e testi

Data: 2026-10-09

Il dialog «Importa operazioni» (Investimenti) è ridisegnato nello stile di Panoramica e Liquidità: sezioni aperte con icona tinta, numeri grandi, niente riquadri grigi. Nessun parser o calcolo è cambiato; cambiano presentazione, testi e ordine delle informazioni.

- **Percorso**: File → Anteprima → Strumenti → Conferma, sempre con gli stessi nomi (prima il secondo passo cambiava tra «Colonne» e «Controllo»). Su telefono «Passo 2 di 4» con barra a segmenti, perché le etichette non ci stavano.
- **Scelta del broker**: elenco di righe (non schede) e, sotto la riga scelta, istruzioni numerate per esportare il file (`exportSteps` e `note` in `providers.ts`, al posto di `howTo`). La scelta resta facoltativa: il formato si riconosce anche dal file.
- **Errori**: `lib/investments/import/messages.ts` riscrive i messaggi dei parser («Riga 225: amount non valido» → «Alla riga 225 il campo «importo» non contiene un valore valido» + cosa fare); il messaggio originale resta come «Dettaglio tecnico». Messaggi sconosciuti passano invariati, senza suggerimenti inventati.
- **Strumenti**: `describeChoice` racconta lo stato (già tuo, nuovo collegato in automatico, da controllare, prezzi del broker perché in un'altra valuta, non trovato, fonti non raggiungibili). Gli strumenti che chiedono attenzione sono in cima con la ricerca già aperta; per gli altri il cambio è su richiesta.
- **Conferma e dopo**: numeri in evidenza, righe da correggere con la loro spiegazione, e a import concluso «Cosa è successo» e «Cosa fare ora» con i link a Operazioni e (per Trade Republic) a Liquidità.

Scelte tra alternative: gli errori stanno in cima al contenuto e vengono portati in vista (non in fondo, dove su telefono restringevano l'area scorrevole); le righe saltate di proposito (es. imposta di bollo) sono raggruppate per motivo, quelle da correggere elencate una a una; la scelta del broker resta nel primo passo invece di diventare un passo a sé, per tenere quattro passi.

Rimandato: spostare la scelta del portafoglio di destinazione anche per gli altri broker, riepilogo con importi totali per valuta, import di più file Fineco insieme. Screenshot prima/dopo nel progetto, cartella `investimenti-import-flusso`.

## Gestione importazioni (stessa PR)

Su richiesta dell'utente («sembra messa lì a caso») la sezione in Operazioni è ridisegnata: non più un «Gestisci importazioni» chiuso con due pulsanti uguali per ogni riga, ma una sezione «Importazioni» sempre visibile.

- **Lista**: raggruppata per broker; ogni riga ha periodo coperto, data di caricamento, dettagli (posizioni, movimenti di cassa) e stato (Importato, N avvisi, o lo stato del CSV personale). Dopo sei righe «Mostra tutte». Vive in `import-history.ts` (puro, testato) e `import-history-list.tsx`.
- **Azioni**: tolto «Aggiorna CSV» (apriva solo il dialog, senza dire cosa faceva); ora un solo «Importa un file» e una frase che spiega che un file più recente sostituisce i periodi sovrapposti. Resta «Elimina» per riga.
- **Conferma di eliminazione** (`import-delete-dialog.tsx`): «Viene eliminato» con l'elenco dei caricamenti coinvolti (anche quelli successivi dello stesso conto) e «Resta com'è», con pulsante esplicito («Elimina 2 importazioni»). Logica di eliminazione invariata.
- **Riparti da zero** spostato in «Opzioni avanzate», senza riquadro e con il pulsante non più pieno rosso.

Rimandato: numero di operazioni per importazione e vista di cosa contiene (richiedono un'estensione dell'API `/api/investments/statements`), annullamento dell'ultima importazione.
