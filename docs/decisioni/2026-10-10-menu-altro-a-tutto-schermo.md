# Menu «Altro» a tutto schermo su mobile

Data: 2026-10-10

Su mobile «Altro» nella barra in basso apriva la sidebar come pannello laterale a mezzo schermo, con le stesse voci del desktop. Ora apre una vista a tutto schermo (`components/layout/mobile-more-menu.tsx`): account in alto (porta a Impostazioni), le sezioni fuori dalla barra (Pensione, Analitiche) con una riga che spiega cosa c'è dentro, «Il tuo quadro» (gli stessi moduli della sidebar, accesi o spenti da Impostazioni), preferenze veloci (tema chiaro/scuro/sistema, nascondi importi), Esci, link legali e versione.
Si chiude con ×, Esc o il tasto indietro del telefono (all'apertura si aggiunge una voce di cronologia e si consuma alla chiusura). Righe alte almeno 44 px. Con la barra in basso spenta in Impostazioni resta l'hamburger con il pannello laterale di prima.
Scelte mie, da confermare: nessun modulo nuovo, e il riepilogo riusa lo stile della sidebar (piccolo per il telefono ma già leggibile). Evento Umami `more_menu_clicked` con `target`.
Rimandato: moduli del riepilogo ridisegnati per il telefono (numeri più grandi, nello stile Panoramica), voce Aiuto (non esiste ancora una pagina), riordino delle sezioni.
