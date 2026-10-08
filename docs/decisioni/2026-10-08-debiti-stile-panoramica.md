# Debiti nello stile della Panoramica

Data: 2026-10-08

Stesso lavoro fatto per Investimenti (vedi `2026-10-08-investimenti-stile-panoramica.md`): tutta la sezione Debiti adotta lo stile standard di Panoramica e Liquidità. Solo presentazione: nessun calcolo, dato, route, evento Umami o migration cambia.
Pagina `/debiti`: testata con il debito totale in `MoneyHero` (decimali attenuati) e la data in cui si è liberi da debiti; due colonne 3/5 + 2/5 da `lg` (Prossime rate e I tuoi debiti | Come uscirne prima e Dove paghi di più); pagina larga come la Panoramica (`max-w-6xl`). Dettaglio finanziamento: niente riquadro unico, ma anello e residuo in `MoneyHero`, avviso sulle rate da confermare come riga con filettature, «E se…» e registro affiancati, piano delle rate a tutta larghezza; ogni parte è una sezione aperta con icona tinta (`PanelSection`, colori in `debts-theme.ts`).
Dialog (aggiungi debito a due passi con `DialogSteps`, segna pagata, estinzione anticipata, cambio tasso, correzione residuo): `PanelDialogHeader`, sotto-sezioni con titolo (`DialogSection`) e piè con azioni (`DialogActions`). Le conferme `AlertDialog` restano invariate.
Riuso: `PanelSection` e i pezzi dei dialog stanno ancora in `components/domain/investments` (nessun componente condiviso toccato). Quando si passerà a una cartella condivisa (con la Pensione, che fa lo stesso lavoro) basterà spostarli. `DebtsListCard` non riceve più `totalDebt` (il totale è nella testata).
Questa PR è costruita sopra quella di Investimenti (#184) perché ne usa i componenti: va unita dopo di essa.
