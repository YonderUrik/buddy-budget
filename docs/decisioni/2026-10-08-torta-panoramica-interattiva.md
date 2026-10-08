# Torta del patrimonio in Panoramica: etichette sobrie e interazione

- La scritta al centro della torta era troppo grande rispetto al resto della pagina: ora è più piccola (`text-2xl` + `text-xs`), con le stesse classi tipografiche delle righe accanto.
- Al passaggio del mouse (o al focus sulla riga) la fetta si evidenzia, le altre si attenuano e il centro mostra nome, importo e quota. Al clic/tocco la fetta resta bloccata (secondo clic la sblocca): su touch non c'è hover, quindi il tocco è l'unico modo per leggere i numeri.
- Torta e righe sono collegate nei due sensi; le righe restano link alle sezioni, nessun filtro né navigazione dalla fetta.
- Il componente `NetWorthCompositionRow` è usato solo da Panoramica (la torta di Movimenti > Analisi è un altro componente, invariato).
- Evento Umami `overview_composition_slice_selected` (solo classe di asset) al blocco di una fetta. Nessuna nuova API, metrica o dipendenza.
