# Investimenti nello stile della Panoramica

Data: 2026-10-08

Daniele vuole la Panoramica rifatta (ispirazione Wealthfolio) come standard del prodotto: Investimenti, tutte le schede, la adotta a gruppi di schede, una PR per gruppo. Solo presentazione: nessun calcolo, dato o route cambia.
Regole del linguaggio, riusate dalla Panoramica: un solo grafico a tutta larghezza con importo grande (`MoneyHero`, decimali attenuati) e selettore del periodo centrato sotto; le altre parti sono sezioni aperte senza riquadro, con icona tinta nel colore del loro ambito (`SectionHeading`) e righe separate da filettature; due colonne da `lg` (3/5 + 2/5); pagina larga come la Panoramica (`max-w-6xl`).
Nuovo componente `PanelSection` (`components/domain/investments`) che sostituisce `Card` + `CardTitle` nelle schede; `MoneyHero` ora è esportato dal barrel di `net-worth`. Prima PR: layout e scheda Portafoglio. Seguono Performance + Diversificazione, Dividendi + Tasse, Operazioni + Titoli.
