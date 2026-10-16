# Investimenti (Investments): the Titoli (Securities) tab is gone, a security opens from Posizioni (Positions)

- Removed the «Titoli» tab. The name of each position is a link to the security page (`/investimenti/titoli/[id]`, unchanged: used by alert emails and the sidebar).
- In the Portfolio, at the top of Posizioni, there is the «Cerca un titolo» ("Search for a security") search (name, ticker, ISIN; it also finds securities sold with operations and market ones); choosing a result opens the security page.
- Securities followed but not owned (watchlist, with alerts and change) are in the «Seguiti» ("Followed") section below Posizioni, shown only if there are any. Nothing that was in Titoli is lost.
- `/investimenti/titoli` redirects to `/investimenti`; the security page highlights Portafoglio and its «back» returns there; the sidebar's «Mostra tutti» ("Show all") leads to the Portfolio.
- Observability: new Umami event `investment_title_searched` (instrument type only). No new log or metric.
