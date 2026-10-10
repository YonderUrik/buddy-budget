# Tema e «Nascondi importi» passano nel menu utente (2026-10-10)

- Tolto il pulsante (interruttore sole/luna) dal fondo della sidebar e dall'intestazione mobile: occupava spazio fisso in due punti.
- Nuova voce «Tema» nel menu dell'avatar (sidebar desktop e drawer mobile) con sottomenu Chiaro · Scuro · Sistema; la scelta corrente è mostrata accanto alla voce ed esposta come radio.
- Restano invariati: «Altro» su mobile (barra in basso) e Impostazioni → Preferenze, che già avevano la scelta a tre vie, e la logica di `next-themes` (persistenza in localStorage, «Sistema» segue il dispositivo, niente flash al caricamento).
- Landing e login non usano questo componente: non toccati. `ThemeToggle` resta solo nella style guide.
- Nuovo evento Umami `theme_changed` (`choice`, `source`); `more_menu_clicked: tema` resta.
- Rimandata: scorciatoia da tastiera per cambiare tema.
- Stessa cosa per «Nascondi gli importi»: tolto il pulsante occhio dal piede della sidebar e dall'intestazione mobile (componente `PrivacyToggle` rimosso), nuova voce con spunta nel menu avatar; resta l'occhio del riepilogo «Oggi» e la riga in «Altro» su mobile. Evento Umami `amounts_hidden_toggled`.
