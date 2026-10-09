# Sidebar senza seconda barra di scroll

Data: 2026-10-09

Su finestre basse (sotto ~780 px di altezza) il riepilogo sotto le voci del menu supera lo spazio e la nav della sidebar scorreva da sola, mostrando al passaggio del mouse una barra accanto a quella della pagina: in Liquidità · Movimenti, che è lunga, si vedevano due barre una vicina all'altra.
La nav resta scorrevole (rotella, tocco, tastiera) ma non disegna più la barra (`.sidebar-nav` in `app/globals.css`). Resta quindi una sola barra visibile, quella della pagina.
Aperto: se il riepilogo dovesse crescere ancora, valutare di nascondere le righe meno importanti sulle finestre basse invece di farle scorrere.
