# 2026-10-19 — Confirming a subscription with a long bank description

«È un abbonamento» did nothing for detected subscriptions whose name (the raw bank description of the last charge) was longer than 80 characters: the API refused it with 400 «Il nome è troppo lungo» and the list showed no error. The same happened with «Non lo è» on those items; short names worked for both.

Decided: for decisions on detected subscriptions the name is a snapshot, shortened to 80 characters instead of rejected, and the key limit goes from 200 to 1000 characters (it must match the detected key exactly). Names typed by the user keep the 80-character limit. Every refused save now logs `subscriptions.save.rejected` and the list shows the error as a toast instead of failing silently.
