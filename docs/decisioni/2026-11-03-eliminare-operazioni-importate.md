# Deleting a single imported operation (2026-11-03)

Daniele could not delete a single buy or sell that came from a broker file: the delete button was disabled for every operation of a reconciled statement, because the next import checks the app's quantities against the broker's positions and would have failed. Now the operation can be deleted (after a confirmation; editing stays off) and the deletion is remembered in `broker_operation_exclusions` (migration 0055): later imports of the same source (statements and the Trade Republic connection) leave it out but still count it in the reconciliation. A deletion is forgotten when the broker no longer reports that operation, when leaving it out would oversell, or when the statements, the account or the history are deleted, so importing the file again brings it back.

Same PR, also asked by Daniele: every row in Operazioni shows where it comes from (broker, or portfolio name), hidden when there is a single source.

Living docs: `docs/architecture/investments.md` §4.14–4.15.
