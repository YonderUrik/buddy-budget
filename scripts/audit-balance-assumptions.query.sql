-- Read-only audit of the account balance model assumptions, as ONE query (runs in DBeaver or psql).
-- Same checks as audit-balance-assumptions.sql. Returns (check, bad, context): counts only, no personal data.
-- `bad` = rows that break the assumption (0 = holds).
WITH
broker_acc AS (
  SELECT a.id, a.user_id, a.created_at FROM accounts a
  WHERE EXISTS (SELECT 1 FROM broker_import_accounts b WHERE b.cash_account_id = a.id)
     OR EXISTS (SELECT 1 FROM investment_portfolios p WHERE p.statement_cash_account_id = a.id)),
fam AS (
  SELECT a.id, a.source, a.type, a.is_demo,
    EXISTS (SELECT 1 FROM bank_account_links l WHERE l.account_id = a.id) AS bank,
    EXISTS (SELECT 1 FROM trade_republic_connections c WHERE c.account_id = a.id) AS tr_direct,
    EXISTS (SELECT 1 FROM personal_formats f WHERE f.account_id = a.id) AS file_import,
    a.id IN (SELECT id FROM broker_acc) AS broker
  FROM accounts a),
other_manual AS (
  SELECT f.id, a.user_id, a.created_at, a.updated_at FROM fam f JOIN accounts a ON a.id = f.id
  WHERE f.source = 'manuale' AND NOT f.is_demo AND NOT f.file_import AND NOT f.broker),
st AS (
  SELECT s.*, coalesce(s.statement->>'provider', 'interactive-brokers') AS provider,
    CASE WHEN jsonb_typeof(s.statement->'cash') = 'array' THEN s.statement->'cash' ELSE '[]'::jsonb END AS cash,
    CASE WHEN jsonb_typeof(s.statement->'ledger') = 'array' THEN s.statement->'ledger' ELSE '[]'::jsonb END AS ledger
  FROM broker_statements s),
st_cash AS (
  SELECT st.id, st.user_id, st.account_key, st.provider, st.period_from, st.ledger, x->>'currency' AS cur,
    (x->>'opening')::numeric AS opening, (x->>'closing')::numeric AS closing
  FROM st, jsonb_array_elements(st.cash) x),
st_seq AS (
  SELECT *, lag(closing) OVER w AS prev_closing, lag(period_from) OVER w AS prev_from
  FROM st_cash WINDOW w AS (PARTITION BY user_id, account_key, cur ORDER BY period_from)),
st_moved AS (
  SELECT c.provider, c.opening, c.closing,
    coalesce((SELECT sum((e->>'amount')::numeric) FROM jsonb_array_elements(c.ledger) e
              WHERE e->>'currency' = c.cur AND coalesce((e->>'includedInCommission')::boolean, false) = false), 0) AS moved
  FROM st_cash c),
st_periods AS (
  SELECT period_from, lag(period_to) OVER (PARTITION BY user_id, account_key ORDER BY period_from) AS prev_to FROM broker_statements),
first_st AS (
  SELECT DISTINCT ON (user_id, account_key) provider, cash FROM st ORDER BY user_id, account_key, period_from),
st_cur AS (
  SELECT user_id, cur, min(period_from) AS first_day FROM st_cash GROUP BY 1, 2),
ba_user AS (SELECT user_id, min(created_at) AS created_at FROM broker_acc GROUP BY 1),
cash_rows AS (SELECT * FROM net_worth_snapshots WHERE asset_class = 'liquidita')
SELECT * FROM (VALUES
  ('A0 account families (source/bank/trDirect/fileImport/broker/brokerType = n)', NULL::bigint,
    (SELECT string_agg(k || ' = ' || n, '; ' ORDER BY n DESC) FROM (
       SELECT concat_ws('/', source, bank, tr_direct, file_import, broker, type = 'Liquidità broker') AS k, count(*) AS n FROM fam WHERE NOT is_demo GROUP BY 1) g)),
  ('A1 accounts in more than one family', (SELECT count(*) FROM fam WHERE bank::int + tr_direct::int + file_import::int + broker::int > 1), NULL),
  ('A2 broker-linked account not typed «Liquidità broker»', (SELECT count(*) FROM fam WHERE broker AND type <> 'Liquidità broker'), NULL),
  ('A3 «Liquidità broker» account with no broker link', (SELECT count(*) FROM fam WHERE type = 'Liquidità broker' AND NOT broker), NULL),
  ('A4 auto account with no bank link and no TR connection', (SELECT count(*) FROM fam WHERE source = 'auto' AND NOT bank AND NOT tr_direct),
    'of which demo: ' || (SELECT count(*) FROM fam WHERE source = 'auto' AND NOT bank AND NOT tr_direct AND is_demo)),
  ('A5 users with TR direct connection AND TR statement files', (SELECT count(DISTINCT c.user_id) FROM trade_republic_connections c JOIN broker_import_accounts b ON b.user_id = c.user_id AND b.provider = 'trade-republic'), NULL),
  ('B0 statements by provider (statements/accounts/users)', NULL,
    (SELECT string_agg(provider || ': ' || n || '/' || a || '/' || u, '; ') FROM (SELECT provider, count(*) n, count(DISTINCT account_key) a, count(DISTINCT user_id) u FROM st GROUP BY 1) g)),
  ('B1 statements missing cash or ledger arrays', (SELECT count(*) FROM broker_statements WHERE jsonb_typeof(statement->'cash') IS DISTINCT FROM 'array' OR jsonb_typeof(statement->'ledger') IS DISTINCT FROM 'array'), NULL),
  ('B2a gaps between consecutive statements', (SELECT count(*) FROM st_periods WHERE prev_to IS NOT NULL AND period_from > prev_to + 1), NULL),
  ('B2b overlaps between consecutive statements', (SELECT count(*) FROM st_periods WHERE prev_to IS NOT NULL AND period_from <= prev_to), NULL),
  ('B3 opening differs from previous closing (per currency)', (SELECT count(*) FROM st_seq WHERE prev_from IS NOT NULL AND abs(opening - prev_closing) > 0.01), NULL),
  ('B4 ledger does not add up to closing - opening (per currency)', (SELECT count(*) FROM st_moved WHERE abs(opening + moved - closing) > 0.01),
    (SELECT string_agg(provider || ' ' || bad || '/' || n, '; ') FROM (SELECT provider, count(*) FILTER (WHERE abs(opening + moved - closing) > 0.01) bad, count(*) n FROM st_moved GROUP BY 1) g)),
  ('B5 ledger entries dated outside their period', (SELECT count(*) FROM st, jsonb_array_elements(st.ledger) e WHERE (e->>'date')::date < st.period_from OR (e->>'date')::date > st.period_to), NULL),
  ('B6 first statement opens with a non-zero balance', (SELECT count(*) FROM first_st WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(cash) x WHERE abs((x->>'opening')::numeric) > 0.01)),
    (SELECT string_agg(provider || ' ' || n, '; ') FROM (SELECT provider, count(*) n FROM first_st GROUP BY 1) g) || ' broker accounts'),
  ('B7 non-EUR statement currency without a rate up to 10 days after its first day', (SELECT count(*) FROM st_cur c WHERE c.cur <> 'EUR' AND NOT EXISTS (SELECT 1 FROM fx_rates r WHERE r.currency = c.cur AND r.date <= c.first_day + 10)),
    'non-EUR user/currency pairs: ' || (SELECT count(*) FROM st_cur WHERE cur <> 'EUR')),
  ('C1 users with broker statements whose currency is not EUR', (SELECT count(DISTINCT s.user_id) FROM broker_statements s JOIN auth_user u ON u.id = s.user_id WHERE u.currency <> 'EUR'), NULL),
  ('D0 stored cash history (rows/users/no ledger part/last day)', NULL,
    (SELECT count(*) || '/' || count(DISTINCT user_id) || '/' || count(*) FILTER (WHERE ledger_amount IS NULL) || '/' || coalesce(max(date)::text, '-') FROM cash_rows)),
  ('D1 users with broker cash (cash days before/after the account)', (SELECT count(*) FROM ba_user),
    (SELECT count(*) FILTER (WHERE n.date < b.created_at::date) || ' before / ' || count(*) FILTER (WHERE n.date >= b.created_at::date) || ' after' FROM ba_user b JOIN cash_rows n USING (user_id))),
  ('D2 double-count risk: days before the broker account with a non-zero manual part, users without other manual accounts',
    (SELECT count(*) FROM cash_rows n JOIN ba_user b USING (user_id) WHERE n.date < b.created_at::date AND abs(n.amount - coalesce(n.ledger_amount, 0)) > 0.01 AND n.user_id NOT IN (SELECT user_id FROM other_manual)),
    'users: ' || (SELECT count(DISTINCT n.user_id) FROM cash_rows n JOIN ba_user b USING (user_id) WHERE n.date < b.created_at::date AND abs(n.amount - coalesce(n.ledger_amount, 0)) > 0.01 AND n.user_id NOT IN (SELECT user_id FROM other_manual))),
  ('D3 estimate-drift risk: users with broker cash AND other manual accounts', (SELECT count(DISTINCT b.user_id) FROM ba_user b JOIN other_manual m USING (user_id)), NULL),
  ('D4 manual accounts edited after creation (edited / after a day / all manual)', NULL,
    (SELECT count(*) FILTER (WHERE updated_at > created_at + interval '1 minute') || ' / ' || count(*) FILTER (WHERE updated_at - created_at > interval '1 day') || ' / ' || count(*) FROM other_manual)),
  ('E1 hand-typed transactions on broker cash accounts', (SELECT count(*) FROM transactions t WHERE t.account_id IN (SELECT id FROM broker_acc) AND (t.external_id IS NULL OR t.external_id NOT LIKE 'trade-republic:%')), NULL),
  ('E2 transactions dated in the future (rows; users in context)', (SELECT count(*) FROM transactions WHERE date > current_date),
    'users: ' || (SELECT count(DISTINCT user_id) FROM transactions WHERE date > current_date))
) AS audit("check", bad, context);
