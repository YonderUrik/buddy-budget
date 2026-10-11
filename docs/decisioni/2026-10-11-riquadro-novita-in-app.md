# Striscia «Novità» in app

Data: 2026-10-11

- **Decisione**: le novità si annunciano con un riquadro nella Panoramica (una voce alla volta, chiudibile), non con un'email a tutti: l'email promozionale richiede una base giuridica e un testo privacy dedicati, da vedere con un professionista. La bozza `featureAnnouncementEmail` resta in repo, non collegata a nessun invio.
- **Curato a mano**: `lib/whats-new/entries.ts` contiene solo le funzioni che meritano una voce, non ogni release. Una voce smette di comparire dopo 45 giorni; la chiusura si ricorda per dispositivo (localStorage).
- **Perché localStorage**: evita una migration e una richiesta in più; il limite è che chi cambia dispositivo la rivede.
- **Rimandato**: chiusura legata all'account, pagina con l'elenco di tutte le novità, voce nella sidebar, annuncio via email con preferenza dedicata.
- **Landing**: nessun impatto. **Prestazioni**: nessun JS pesante aggiunto, nessuna immagine; la striscia compare dopo l'idratazione e prima dei dati, quindi senza salti.
- **Aggiornamento**: dopo il primo giro la voce è diventata una striscia di una riga (senza immagine né testo lungo; la spiegazione è nel `title` del link) per essere poco invasiva. Rimandato: voce nella sidebar o pagina con tutte le novità.
