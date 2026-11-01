# Deleting an account takes its imports (2026-11-01)

Daniele asked to delete a past portfolio from Liquidità › Conti together with all its transactions and the imports that «Gestisci importazioni» shows. Until now «Elimina il conto» removed only the account and its cash movements: the portfolio, its operations, the broker statements and the uploaded files stayed, and a re-import found them.

Now the confirmation first asks the server what goes (`previewAccountDeletion`) and lists it; the deletion sends back the token and is refused if anything changed in between. A broker's cash account or a file's account takes the portfolio fed only by it, its operations, statements, formats and uploads. A portfolio shared with something else (the one of hand-entered operations, another broker account) stays and loses only this account's operations; a deletion that would leave a sale without its buys is refused. Instruments and prices stay. An account with only cash movements behaves as before.

Deferred: deleting a portfolio from Investimenti (the account is the handle users see today), undo.
