# Landing e accesso: ritocchi dopo la prova di Daniele (2026-10-11)

- **Apertura**: «Foglio1» e «BuddyBudget» si alternano da sole, con una barra che si riempie sotto la scheda attiva; si fermano al passaggio del mouse o fuori schermo, smettono al primo clic e non partono con «riduci movimento». In vista app la barra della formula mostra il patrimonio e l'indirizzo dell'app. La Panoramica non è più ritagliata.
- **Screenshot**: la cattura allunga la finestra fino all'altezza della pagina (tetto 1500 px, 1200 per Movimenti, 1000 per la Simulazione) e salva le dimensioni nel manifest; `AppShot` le usa per riservare lo spazio. L'apertura usa `panoramica-top.jpg`, solo la parte alta.
- **Giro dell'app**: al posto delle schede a pillola un indice numerato delle aree a sinistra (sul telefono una griglia a due colonne), non fisso.
- **Schermate su telefono**: ogni area è una riga con le sue schermate a capo, niente più striscia che scorre di lato.
- **Accesso**: titolo «Entra in BuddyBudget»; al posto delle schede «Cosa c'è dentro», «Novità» e «In arrivo» un foglio dei conti d'esempio che riga dopo riga diventa quello di BuddyBudget (`AuthSheetExample`). Tolti l'evento Umami `login_sheet_tab_selected` e il legame del login con il catalogo.
- **Altro**: regole italiane leggibili sul telefono, «Rata N pagata» senza «0,00 €» quando la rata non ha importo, seed demo allineato alle nuove categorie (Freelance → Altre entrate).
