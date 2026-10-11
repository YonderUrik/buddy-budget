# Investimenti: la scheda Titoli non c'è più, il titolo si apre dalle Posizioni

- Tolta la scheda «Titoli». Il nome di ogni posizione è un link alla pagina del titolo (`/investimenti/titoli/[id]`, invariata: la usano email degli avvisi e sidebar).
- Nel Portafoglio, in testa alle Posizioni, c'è la ricerca «Cerca un titolo» (nome, ticker, ISIN; trova anche titoli venduti con operazioni e quelli di mercato); scegliere un risultato apre la pagina del titolo.
- I titoli seguiti ma non posseduti (watchlist, con avvisi e variazione) stanno nella sezione «Seguiti» sotto le Posizioni, mostrata solo se ce ne sono. Nulla di quanto c'era in Titoli è perso.
- `/investimenti/titoli` reindirizza a `/investimenti`; la pagina del titolo evidenzia Portafoglio e il suo «indietro» torna lì; il «Mostra tutti» della sidebar porta al Portafoglio.
- Osservabilità: nuovo evento Umami `investment_title_searched` (solo tipo dello strumento). Nessun nuovo log o metrica.
