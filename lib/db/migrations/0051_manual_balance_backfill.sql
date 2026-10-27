-- One-off correction (decision 2026-10-27, docs/decisioni/2026-10-27-saldo-dei-conti-manuali.md): until today a
-- transaction typed by hand never moved its manual account's balance. Adds to each manual account the hand-typed
-- transactions created after the account was last edited: earlier ones may already be in a balance corrected by hand.
-- Leaves out bank-linked, file-import and broker cash accounts, sample-data accounts and imported rows.
DO $$
DECLARE corrected integer;
BEGIN
  WITH hand AS (
    SELECT t.account_id, sum(t.amount) AS delta
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.source = 'manuale'
      AND a.is_demo = false
      AND t.source = 'manuale'
      AND t.external_id IS NULL
      AND t.created_at > a.updated_at
      AND NOT EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM broker_statements s WHERE s.cash_account_id = a.id)
    GROUP BY t.account_id
  )
  UPDATE accounts
  SET balance = accounts.balance + hand.delta, updated_at = now()
  FROM hand
  WHERE accounts.id = hand.account_id AND hand.delta <> 0;
  GET DIAGNOSTICS corrected = ROW_COUNT;
  RAISE NOTICE 'manual_balance_backfill: % accounts corrected', corrected;
END $$;
