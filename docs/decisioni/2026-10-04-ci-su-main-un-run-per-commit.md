# CI su main: un run per commit e deploy dopo le check

Data: 2026-10-04

Con un solo gruppo `concurrency` su `main` GitHub teneva un run in attesa e scartava gli intermedi: con due merge ravvicinati il run della PR di release poteva non partire e la versione non veniva distribuita (osservato anche il ritardo: il run delle 21:23 è partito solo alle 21:28, dopo la fine di quello della release). Ora ogni commit ha il suo gruppo. Per non allungare il deploy, `release` non aspetta più i test e le immagini si costruiscono in parallelo ai test (deploy da ~6,5 a ~4,5 minuti); il deploy resta condizionato alle check. Su `main` si saltano lint e test dell'app per i merge di sola landing/documenti. Il tag in infra non retrocede mai e due deploy ravvicinati si serializzano (vince l'ultimo). Rischio accettato: la PR di release e il tag possono nascere anche se i test falliscono, ma non vengono distribuiti. Decisione di Daniele ("si vai", 2026-10-04) sul report CI.
