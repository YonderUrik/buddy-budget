# Sicurezza

## Segnalare una vulnerabilità

Se trovi una vulnerabilità, **non aprire una issue pubblica**. Usa la funzione "Report a vulnerability" della scheda *Security* del repository (segnalazione privata di GitHub). Includi i passi per riprodurla e, se puoi, l'impatto che immagini.

Il progetto è mantenuto da una persona sola: la risposta può richiedere qualche giorno. Non esiste un programma di ricompense.

## Cosa non va mai nel repository

Chiavi, token, credenziali, dati bancari o personali reali. Se ne trovi per errore in un file o nella history, segnalalo nello stesso modo. Le variabili d'ambiente vanno in `.env.local` (ignorato da git); [`.env.local.example`](.env.local.example) contiene solo segnaposto.
