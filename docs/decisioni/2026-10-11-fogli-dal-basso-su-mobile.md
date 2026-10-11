# Fogli dal basso su mobile per popover, dialog e conferme

Data: 2026-10-11

Su telefono (sotto `sm`, 640px) popover, dialog e conferme non sono più finestre ancorate o centrate da far scorrere: si aprono come foglio dal basso a tutta larghezza, con sfondo scuro, maniglia e chiusura trascinando giù (o toccando fuori). È il comportamento di default di `PopoverContent`, `DialogContent` e `AlertDialogContent`, quindi vale in tutta l'app senza toccare i chiamanti; da `sm` in su non cambia nulla. I form lunghi restano a tutto schermo (`FormDialogContent` passa `mobileLayout="fullscreen"`). I pannelli che su desktop si aprono sotto la riga (Dividi, Modifica di un movimento) usano `InlineOrSheet`: inline da `sm` in su, foglio sul telefono. Il gesto sta in `lib/motion/sheet.ts`.

Rimandato: menu a tendina (`DropdownMenu`) e `Select` restano ancorati al pulsante; le carte di Categorizza e la scheda «Quanto rischia» non sono state toccate (lavori in corso in altri thread).
