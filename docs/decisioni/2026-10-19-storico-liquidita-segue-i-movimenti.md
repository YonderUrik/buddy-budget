# Cash history follows the transactions

Data: 2026-10-19

After importing a file in Liquidità the chart did not follow: the new account counted only from today, so the curve stayed flat and jumped on the last point. The cash history was rebuilt only once, the first time a user had no row, and only from bank-synced accounts; file-import accounts were treated as manual and every later import, connected bank, edited or deleted transaction was ignored.

Now every cash row stores its ledger part (`net_worth_snapshots.ledger_amount`, migration 0043): the share that comes from accounts whose balance follows their transactions (bank sync and file imports). When those transactions change, `refreshDerivedCashHistory` moves only that share on every past day and adds the missing days (at most 24 months back); the manual balances a snapshot recorded stay as they were. It runs only when a fingerprint of accounts and transactions changes, from the cron, the history endpoint, the sidebar and Analitiche. Rows written before the migration get their ledger part estimated once from when they were written. The per-account chart in Liquidità also draws file-import accounts from their transactions.

While an import or bank sync runs, the Panoramica and Liquidità charts say so («Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.»), then «Aggiorno il grafico con i nuovi movimenti…» until the reloaded history arrives; the note floats over the chart and the old curve is dimmed. An import confirmed from «Righe da controllare» now refreshes the data too, and a bank sync refreshes the sidebar total.

Closes the known debt "cash history reconstructed only once". Still out: manual accounts have no past (a manual account added later is a jump), broker statement cash accounts count as manual. Living doc: `docs/architecture/net-worth.md` §4.1 and §4.13.
