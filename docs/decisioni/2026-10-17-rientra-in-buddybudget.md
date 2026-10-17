# 2026-10-17 — «Rientra in BuddyBudget» after signing out

Feedback from Daniele: after «Esci» the login page looked like a first visit, so getting back in meant typing the email and waiting for a new link. Of three options (welcome-back screen, plus an emailed code, plus passkeys) he chose the welcome-back screen alone.

- While signed in, the app layout remembers on the device the account's email (localStorage `bb.returning-user`) and the last sign-in method (better-auth `lastLoginMethod` plugin, readable cookie, 30 days, no database field). Nothing new is stored on the server.
- `/login` then opens on «Rientra in BuddyBudget»: masked email, one main button for the method used last time (link to the remembered address, or Google), the other method one tap away, and «Non sei tu?» that forgets the account and shows the full form. Deleting the account forgets it too. Works after an expired session as well, not only after «Esci».
- Security unchanged: same session length, same magic link, the remembered email only spares retyping it. Cookie page updated (to include in the professional review of the legal texts).
- Umami: `returning_login_used` (method), `returning_login_forgotten`.
- Deferred: emailed code for the installed app, passkeys.
