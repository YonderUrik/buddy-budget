# Pulsante «indietro» unico (2026-10-11)

Le pagine figlie (Categorizza, Importa da CSV, dettaglio di un debito, scheda di un titolo, gruppo di Impostazioni su telefono, Conti trovati dopo il collegamento della banca) avevano cinque ritorni diversi: solo icona da 32 px, testo sottolineato «← Torna a…», freccia o chevron, con o senza area di tocco da 44 px. Ora usano tutte `BackLink` (`components/domain/shared`): «‹ Nome della pagina madre», sopra il titolo, area di tocco 44 px, stesso colore.

Il ritorno porta sempre alla pagina madre (navigazione «su», non cronologia). Dove la testata della sezione ripeteva il nome subito sopra al ritorno (Debiti, Impostazioni su telefono) la testata non si mostra più. In Impostazioni, «‹ Impostazioni» dopo aver aperto un gruppo dall'elenco torna indietro nella cronologia: il tasto indietro del telefono non riapre il gruppo appena chiuso.

Rimandati (analisi nel thread «Navigazione mobile»): il tasto indietro del telefono che chiude fogli e dialog invece di cambiare pagina, e la scelta della navigazione tra le viste di Liquidità/Investimenti/Pensione su mobile.
