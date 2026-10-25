
### Direct Trade Republic

`trade_republic.login.started|completed|failed` and `trade_republic.sync.completed|failed` report sign-in and background cash refresh outcomes without provider bodies or credentials. Query `buddybudget_trade_republic_requests_total{action="login"|"sync",outcome="success"|"error"}` for counts and `buddybudget_trade_republic_request_seconds` for duration. Umami records `trade_republic_login_started` and `trade_republic_connected`; manual updates retain `account_sync_manual`. Before production rollout, add these metrics to the banking dashboard in the infrastructure repository. Staging verifies the new feature without changing production dashboards.
