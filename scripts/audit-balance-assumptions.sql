-- Read-only audit of the assumptions behind the account balance model
-- (docs/superpowers/specs/2026-11-08-account-balances-design.md).
-- Prints counts only: no names, amounts, emails or user ids. Safe on production.
-- Run: psql -X -v ON_ERROR_STOP=1 -f scripts/audit-balance-assumptions.sql
-- Every check prints `bad` = how many rows break the assumption (0 = holds), plus context counts.

BEGIN TRANSACTION READ ONLY;
\pset footer off

\echo '== A. Account kinds: every account belongs to exactly one family'
WITH links AS (
  SELECT a.id, a.source, a.type,
    EXISTS (SELECT 1 FROM bank_account_links l WHERE l.account_id = a.id) AS bank,
    EXISTS (SELECT 1 FROM trade_republic_connections c WHERE c.account_id = a.id) AS tr_direct,
    EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id) AS file_import,
    EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
      OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id)
      OR EXISTS (SELECT 1 FROM broker_statements s WHERE s.cash_account_id = a.id) AS broker
  FROM accounts a WHERE NOT a.is_demo
)
SELECT source, bank, tr_direct, file_import, broker, (type = 'Liquidità broker') AS broker_type, count(*) AS accounts
FROM links GROUP BY 1,2,3,4,5,6 ORDER BY accounts DESC;

\echo '-- A1 accounts in more than one family (bank / TR direct / file import / broker)'
SELECT count(*) AS bad FROM (
  SELECT a.id,
    (EXISTS (SELECT 1 FROM bank_account_links l WHERE l.account_id = a.id))::int
    + (EXISTS (SELECT 1 FROM trade_republic_connections c WHERE c.account_id = a.id))::int
    + (EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id))::int
    + (EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id))::int AS families
  FROM accounts a) x WHERE families > 1;

\echo '-- A2 broker-linked accounts whose type is not «Liquidità broker» (client type check would miss them)'
SELECT count(*) AS bad FROM accounts a
WHERE a.type <> 'Liquidità broker'
  AND (EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id));

\echo '-- A3 «Liquidità broker» accounts with no broker link (client would treat them as broker)'
SELECT count(*) AS bad FROM accounts a
WHERE a.type = 'Liquidità broker'
  AND NOT EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id);

\echo '-- A4 auto accounts with neither a bank link nor a TR connection'
SELECT count(*) AS bad FROM accounts a
WHERE a.source = 'auto'
  AND NOT EXISTS (SELECT 1 FROM bank_account_links l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM trade_republic_connections c WHERE c.account_id = a.id);

\echo '-- A5 users with both a TR direct connection and TR statement files (the guard should prevent it)'
SELECT count(*) AS bad FROM (
  SELECT c.user_id FROM trade_republic_connections c
  JOIN broker_import_accounts b ON b.user_id = c.user_id AND b.provider = 'trade-republic' GROUP BY 1) x;

\echo '== B. Broker statements: complete, contiguous, reconciled'
SELECT coalesce(statement->>'provider', 'interactive-brokers (legacy, no provider)') AS provider,
  count(*) AS statements, count(DISTINCT account_key) AS broker_accounts, count(DISTINCT user_id) AS users,
  count(*) FILTER (WHERE cash_account_id IS NULL) AS without_cash_account
FROM broker_statements GROUP BY 1 ORDER BY 2 DESC;

\echo '-- B1 statements missing the `cash` or `ledger` arrays (cannot be rebuilt day by day)'
SELECT coalesce(statement->>'provider', 'interactive-brokers') AS provider, count(*) AS bad
FROM broker_statements
WHERE jsonb_typeof(statement->'cash') IS DISTINCT FROM 'array' OR jsonb_typeof(statement->'ledger') IS DISTINCT FROM 'array'
GROUP BY 1;

\echo '-- B2 gaps or overlaps between consecutive statements of the same broker account'
WITH s AS (
  SELECT user_id, account_key, period_from, period_to,
    lag(period_to) OVER (PARTITION BY user_id, account_key ORDER BY period_from) AS prev_to
  FROM broker_statements)
SELECT count(*) FILTER (WHERE prev_to IS NOT NULL AND period_from > prev_to + 1) AS gaps,
       count(*) FILTER (WHERE prev_to IS NOT NULL AND period_from <= prev_to) AS overlaps
FROM s;

\echo '-- B3 opening of a statement differs from the previous closing (per currency, > 0.01)'
WITH c AS (
  SELECT s.user_id, s.account_key, s.period_from, x->>'currency' AS cur,
    (x->>'opening')::numeric AS opening, (x->>'closing')::numeric AS closing
  FROM broker_statements s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.statement->'cash') = 'array' THEN s.statement->'cash' ELSE '[]' END) x),
o AS (
  SELECT *, lag(closing) OVER (PARTITION BY user_id, account_key, cur ORDER BY period_from) AS prev_closing,
    lag(period_from) OVER (PARTITION BY user_id, account_key, cur ORDER BY period_from) AS prev_from FROM c)
SELECT count(*) AS bad FROM o WHERE prev_from IS NOT NULL AND abs(opening - prev_closing) > 0.01;

\echo '-- B4 statements whose ledger does not add up to closing - opening (per currency, > 0.01)'
WITH c AS (
  SELECT s.id, coalesce(s.statement->>'provider', 'interactive-brokers') AS provider, x->>'currency' AS cur,
    (x->>'opening')::numeric AS opening, (x->>'closing')::numeric AS closing, s.statement->'ledger' AS ledger
  FROM broker_statements s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.statement->'cash') = 'array' THEN s.statement->'cash' ELSE '[]' END) x
  WHERE jsonb_typeof(s.statement->'ledger') = 'array'),
m AS (
  SELECT c.provider, c.cur, c.opening, c.closing,
    coalesce((SELECT sum((e->>'amount')::numeric) FROM jsonb_array_elements(c.ledger) e
              WHERE e->>'currency' = c.cur AND coalesce((e->>'includedInCommission')::boolean, false) = false), 0) AS moved
  FROM c)
SELECT provider, count(*) FILTER (WHERE abs(opening + moved - closing) > 0.01) AS bad, count(*) AS currency_periods
FROM m GROUP BY 1;

\echo '-- B5 ledger entries dated outside their statement period'
SELECT count(*) AS bad FROM broker_statements s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.statement->'ledger') = 'array' THEN s.statement->'ledger' ELSE '[]' END) e
WHERE (e->>'date')::date < s.period_from OR (e->>'date')::date > s.period_to;

\echo '-- B6 broker accounts whose first statement opens with a non-zero balance (history does not start at opening)'
WITH first AS (
  SELECT DISTINCT ON (user_id, account_key) user_id, account_key, coalesce(statement->>'provider', 'interactive-brokers') AS provider, statement->'cash' AS cash
  FROM broker_statements ORDER BY user_id, account_key, period_from)
SELECT provider, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cash) = 'array' THEN cash ELSE '[]' END) x WHERE abs((x->>'opening')::numeric) > 0.01)) AS non_zero_opening,
  count(*) AS broker_accounts
FROM first GROUP BY 1;

\echo '-- B7 statement currencies with no exchange rate on or before the first statement day (+10 days lookback)'
WITH cur AS (
  SELECT s.user_id, x->>'currency' AS currency, min(s.period_from) AS first_day
  FROM broker_statements s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.statement->'cash') = 'array' THEN s.statement->'cash' ELSE '[]' END) x
  GROUP BY 1, 2)
SELECT count(*) AS bad, count(*) FILTER (WHERE cur.currency <> 'EUR') AS non_eur_pairs
FROM cur WHERE cur.currency <> 'EUR'
  AND NOT EXISTS (SELECT 1 FROM fx_rates r WHERE r.currency = cur.currency AND r.date <= cur.first_day + 10);

\echo '== C. Users and currencies'
\echo '-- C1 users with broker statement accounts whose own currency is not EUR'
SELECT count(DISTINCT s.user_id) AS users FROM broker_statements s JOIN auth_user u ON u.id = s.user_id WHERE u.currency <> 'EUR';

\echo '== D. Stored cash history'
SELECT count(*) AS cash_rows, count(DISTINCT user_id) AS users,
  count(*) FILTER (WHERE ledger_amount IS NULL) AS rows_without_ledger_part,
  count(*) FILTER (WHERE source = 'snapshot') AS snapshot_rows, count(*) FILTER (WHERE source = 'derivato') AS derived_rows,
  max(date) AS last_day
FROM net_worth_snapshots WHERE asset_class = 'liquidita';

\echo '-- D1 users with broker statement accounts, and how many of their cash days fall after the account was created'
WITH ba AS (
  SELECT a.user_id, a.created_at FROM accounts a
  WHERE EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id))
SELECT count(DISTINCT ba.user_id) AS users_with_broker_cash,
  count(n.*) FILTER (WHERE n.date >= ba.created_at::date) AS cash_days_after_creation,
  count(n.*) FILTER (WHERE n.date < ba.created_at::date) AS cash_days_before_creation
FROM ba LEFT JOIN net_worth_snapshots n ON n.user_id = ba.user_id AND n.asset_class = 'liquidita';

\echo '-- D2 (double-count bug) days before the broker account existed whose manual part is not zero, for users with no other manual account'
WITH ba AS (
  SELECT a.user_id, min(a.created_at) AS created_at FROM accounts a
  WHERE EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id)
  GROUP BY 1),
other_manual AS (
  SELECT a.user_id FROM accounts a
  WHERE a.source = 'manuale'
    AND NOT EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id)
  GROUP BY 1)
SELECT count(DISTINCT n.user_id) AS users_affected, count(*) AS days_affected
FROM net_worth_snapshots n JOIN ba ON ba.user_id = n.user_id
WHERE n.asset_class = 'liquidita' AND n.date < ba.created_at::date
  AND abs(n.amount - coalesce(n.ledger_amount, 0)) > 0.01
  AND n.user_id NOT IN (SELECT user_id FROM other_manual);

\echo '-- D3 (estimate drift) users with broker cash AND other manual accounts: the case where the one-time estimate can be off'
WITH ba AS (
  SELECT DISTINCT a.user_id FROM accounts a
  WHERE EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id)),
om AS (
  SELECT DISTINCT a.user_id FROM accounts a
  WHERE a.source = 'manuale' AND NOT a.is_demo
    AND NOT EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id))
SELECT count(*) AS users FROM ba JOIN om USING (user_id);

\echo '-- D4 manual accounts whose balance was edited after creation (their past is only known from snapshots)'
SELECT count(*) FILTER (WHERE a.updated_at > a.created_at + interval '1 minute') AS edited,
  count(*) FILTER (WHERE a.updated_at - a.created_at > interval '1 day') AS edited_after_a_day, count(*) AS of_manual
FROM accounts a WHERE a.source = 'manuale' AND NOT a.is_demo
  AND NOT EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id);

\echo '== E. Movements on accounts that are not supposed to move by hand'
\echo '-- E1 hand-typed transactions on broker cash accounts (they move a balance the next statement overwrites)'
SELECT count(*) AS bad FROM transactions t JOIN accounts a ON a.id = t.account_id
WHERE (EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id) OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id))
  AND (t.external_id IS NULL OR t.external_id NOT LIKE 'trade-republic:%');

\echo '-- E2 transactions dated in the future (each balance line treats them differently today)'
SELECT count(*) AS rows, count(DISTINCT user_id) AS users FROM transactions WHERE date > current_date;

ROLLBACK;
