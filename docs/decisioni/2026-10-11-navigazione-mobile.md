# Navigazione su telefono: viste dal titolo e pulsante «indietro» unico (2026-10-11)

**Viste delle sezioni.** Sotto i 1024 px il menu a tendina «Movimenti · 1 di 5» (PR #271) è sostituito dal titolo della pagina: in piccolo il nome della sezione, sotto la vista corrente «Movimenti ⌄», che apre un foglio dal basso con tutte le viste e le descrizioni (`SectionHeading` + `SectionViewsSheet` in `components/domain/shared`). Scelta di Daniele (proposta B) tra chip scorrevoli, titolo-selettore e foglio dalla barra in basso: libera una riga e usa lo stesso foglio del resto dell'app; restano due tocchi per cambiare vista. Da 1024 px in su resta il segmentato. Eventi Umami `section_views_opened` e `section_view_chosen`. Mockup e analisi nel thread «Navigazione mobile».

**Pulsante indietro.**

Le pagine figlie (Categorizza, Importa da CSV, dettaglio di un debito, scheda di un titolo, gruppo di Impostazioni su telefono, Conti trovati dopo il collegamento della banca) avevano cinque ritorni diversi: solo icona da 32 px, testo sottolineato «← Torna a…», freccia o chevron, con o senza area di tocco da 44 px. Ora usano tutte `BackLink` (`components/domain/shared`): «‹ Nome della pagina madre», sopra il titolo, area di tocco 44 px, stesso colore.

Il ritorno porta sempre alla pagina madre (navigazione «su», non cronologia). Dove la testata della sezione ripeteva il nome subito sopra al ritorno (Debiti, Impostazioni su telefono) la testata non si mostra più. In Impostazioni, «‹ Impostazioni» dopo aver aperto un gruppo dall'elenco torna indietro nella cronologia: il tasto indietro del telefono non riapre il gruppo appena chiuso.

Rimandati: il tasto indietro del telefono che chiude fogli e dialog invece di cambiare pagina (oggi lo fa solo il menu «Altro»); la riga di chip come scorciatoia.
