# 2026-10-12 — Loghi degli esercenti anche in Movimenti

I loghi degli esercenti (PR #351) comparivano solo in Categorizza. Ora anche la lista dei Movimenti in Liquidità li mostra: `GET /api/transactions` aggiunge `logoPath` a ogni riga con la stessa logica (`withMerchantLogos`: dizionario, sito scritto nel movimento, ricerca per nome solo con `LOGODEV_SECRET_KEY`). Il logo prende il posto dell'icona della categoria, che resta piccola nell'angolo: si tocca sempre lì per cambiare categoria. Senza logo (o finché non arriva) resta l'icona di sempre. Sotto l'elenco compare «Loghi forniti da Logo.dev», come in Categorizza.

In produzione oggi c'è solo `LOGODEV_PUBLISHABLE_KEY`: i loghi arrivano per i marchi del dizionario e per i siti scritti nei movimenti, non per la ricerca per nome (serve `LOGODEV_SECRET_KEY` nel Secret `app-logodev-key`).

Su richiesta di Daniele i loghi compaiono ovunque ci sia un esercente: anche in Abbonamenti (`loadSubscriptions` aggiunge `logoPath`, il logo prende il posto dell'iniziale colorata) e nelle Regole (`GET /api/categorization-rules`, al posto dell'icona della categoria, che resta scritta nel menu accanto). Non nel selettore dei movimenti dei Debiti: lì l'icona è minuscola e la lista serve a trovare una rata.
