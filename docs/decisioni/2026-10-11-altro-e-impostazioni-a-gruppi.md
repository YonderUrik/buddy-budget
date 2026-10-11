# Altro più corto e Impostazioni a gruppi (2026-10-11)

- **Altro (mobile)**: account, «Altre sezioni», «Assistenza» (Impostazioni, Aiuto e segnalazioni), l'unico interruttore veloce «Nascondi gli importi» e «Il tuo quadro» chiuso di default (i moduli non caricano dati finché non si apre). Il tema è solo in Impostazioni.
- **Impostazioni**: cinque gruppi (Account, Aspetto e uso, Notifiche e assistente, Privacy e dati, Zona pericolosa) invece di nove blocchi in fila. Desktop: indice a sinistra, un gruppo alla volta. Mobile: elenco dei gruppi, poi il gruppo con freccia indietro. Il gruppo sta in `?sezione=`; i vecchi link con ancora (`#impostazioni-notifiche` nelle email già inviate) rimandano al gruppo giusto.
- **Anteprime** (`settings-preview.tsx`): disegni con i token del tema per barra laterale/barra in basso (reagiscono davvero agli interruttori), email di riepilogo e proposta dell'assistente.
- «Statistiche d'uso anonime» passa da Preferenze a Privacy. Sezioni senza riquadro grigio, con icona colorata (standard Panoramica).
- Evento Umami nuovo `settings_group_opened`; `more_menu_clicked` perde `tema` e guadagna `aiuto`.
- Rimandati: anteprime per valuta/pagina iniziale, ricerca nelle impostazioni, scroll-spy.
