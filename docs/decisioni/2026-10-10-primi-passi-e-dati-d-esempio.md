# Primi passi e dati d'esempio (2026-10-10)

Decisione: dopo l'onboarding chi non ha una banca collegata trova in Panoramica la checklist «Primi passi» (conto, movimenti, investimento, obiettivo) e può avviare «Esplora con dati d'esempio».
La checklist si compila da sola dai dati veri (`lib/start/status.ts`): conto non demo, movimenti `auto` su conti non demo, operazioni di investimento, budget o ipotesi di Analitiche salvate. Si chiude con la X (`auth_user.start_checklist_dismissed_at`) e sparisce quando è completa.
I dati d'esempio sono due conti con `accounts.is_demo` e sei mesi di movimenti; partono solo se l'utente non ha conti, una striscia in ogni schermata li segna come demo e li azzera. Per non mescolarli ai dati veri, finché sono attivi creare conti, movimenti o collegamenti banca risponde 409 `demo_active` (`rejectIfDemoActive`). L'azzeramento toglie conti demo, movimenti e storico della liquidità.
Osservabilità: eventi Umami `start_*` e `demo_*`, log `onboarding.*`, metriche `users_activation{step}` e `start_events_total{event}`; le metriche esistenti su conti e movimenti escludono i dati demo. Migration 0026 (la 0025 è della PR delle email di riepilogo, aperta prima).
Nessuna email né promemoria: le email di riepilogo e avvisi sono di un altro lavoro, con disiscrizione e preferenze di notifica.
Rimandato: riaprire la checklist chiusa (la route lo supporta, manca il punto in UI), demo con investimenti e budget, guardia 409 anche su import personalizzati e operazioni di investimento, esportazione che salta i conti demo, stato vuoto di Analitiche.
