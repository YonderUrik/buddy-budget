# Novità come etichetta accanto alla data

Data: 2026-10-11

- **Decisione**: la striscia «Novità» sopra il grafico (titolo + «Provala →») è sostituita da un'etichetta nella testata della Panoramica, accanto alla data: «✦ Novità: <titolo>». Scelta da Daniele tra due prove sull'app vera (l'altra era una frase in coda al racconto del mese).
- **Movimento**: entra dopo il saluto, la scintilla gira una volta e un riflesso attraversa il testo due volte, poi resta ferma (`.text-sweep-once`, solo CSS). Con il movimento ridotto è testo fermo.
- **Spiegazione**: toccandola si apre un popover (foglio dal basso sul telefono) con il riassunto, il pulsante verso la funzione e «Non mostrare più». Nuovo evento Umami `whats_new_opened`; restano `whats_new_clicked` e `whats_new_dismissed`.
- **Rimandato**: elenco di tutte le novità, chiusura legata all'account.
