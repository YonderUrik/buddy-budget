# User settings and account management — design

Date: 2026-09-29 · Status: **implemented** (branch `claude/user-management-page-4suqzv` in both repos)

## Request

The user wants a page where everyone sets their own parameters and can export their data, reset it, deactivate
the account or delete it permanently. Claude also proposed other features, all of which the user accepted.
Explicit constraint from the user: everything must really work, including session expiry. No "fake" parts.

## Decisions made with the user

| Topic | Choice |
|---|---|
| Deactivation | **Deletion with 30 days to change your mind** (`DEACTIVATION_GRACE_DAYS`). The account is blocked immediately: other sessions closed, sync and crons stopped. A cron deletes it when the period expires. Signing in before then shows "Riattiva account" ("Reactivate account"). |
| Reset | **Everything**: every piece of data is deleted and you start over from onboarding (`onboardingCompleted = false`, EUR currency, default home page, default categories recreated). Account, name, email, sign-in methods and sessions remain. |
| Export | **ZIP with full JSON + CSV** (`;` separator, comma decimals, BOM: they open well in Italian Excel). |
| Additions | Home page chosen by the user, active sessions with sign-out, data summary, **recent login** for sensitive actions. |

## What's on the `/impostazioni` page

It is reached from the avatar menu in the sidebar.

1. **Profile**: editable name, read-only email, sign-up date. Sign-in methods: the magic link
   is always active; for Google there's "Collega" ("Link") if not yet linked (`authClient.linkSocial`).
2. **Preferences**:
   - **currency** (whitelist `SUPPORTED_CURRENCIES`, with a warning that saved amounts are not converted);
   - **home page** (`HOME_PAGE_OPTIONS`; `/` and post-login redirect there);
   - **theme** light/dark/system, per device;
   - **language**, disabled with "Presto" ("Soon") until i18n exists.
3. **Active sessions**:
   - device (from the user agent), last activity, expiry;
   - "Disconnetti" ("Sign out") on a session, "Esci da tutti gli altri dispositivi" ("Sign out of all other devices");
   - expired sessions don't appear;
   - explicit duration in `lib/auth/constants.ts`: 7 days without use, renewed every day (`SESSION_EXPIRES_IN_DAYS`, `SESSION_UPDATE_AGE_DAYS`).
4. **Your data**: summary of counts and "Scarica i miei dati" ("Download my data").
5. **Danger zone**:
   - **Reset**: you type `RESETTA` to confirm;
   - **Deactivate**;
   - **Delete**: you type the account email (case ignored) to confirm.

## Security

- **Recent login** (`RECENT_LOGIN_MAX_AGE_MINUTES = 10`).
  - Applies to export, reset, deactivation and deletion: they respond `403 { code: "reauth_required" }` if the session is older.
  - The UI already knows it from `recentLoginUntil` and shows the "confirm it's you" panel instead of the confirmation: a new magic link or a new Google sign-in, then you return to Impostazioni (Settings) with a new session.
  - Export is included even though it isn't destructive, because it contains all financial data in one file.
- **Deactivated account**: the proxy sends every page to `/account-disattivato` and responds 403 to all APIs except `/api/user/reactivate` (`/api/auth` stays public so you can sign out).
- **User fields not modifiable through better-auth**: all `additionalFields` have `input: false`. Previously `/api/auth/update-user` allowed setting `currency` (without whitelist) and `onboardingCompleted` at will.
- **Sessions**: the list never exposes tokens or IPs. Sign-out checks that the session belongs to the user (IDOR tested).
- **CSV**: values starting with `= + - @` are neutralized (formula injection from bank descriptions). Negative numbers remain numbers.
- **Logs**: only `account.*` events with hashed `user`, no email.

## What gets deleted (reset and deletion)

In FK order, in one transaction:
- PACs (piani di accumulo, recurring investment plans) and investment transactions, portfolios and manual prices;
- **manual instruments created by the user** and not used by others;
- net worth history, transactions, budgets, rules;
- bank connections (links go away by cascade), accounts, categories.

Before the transaction the **GoCardless consents are revoked** (`DELETE /requisitions/{id}/`, best effort: an error doesn't block, the consent expires anyway within 90 days). Afterwards the user's Redis keys are cleaned up (sync jobs, history fingerprint). Reset and deletion respond 409 if a bank sync is in progress.

**Bug avoided while writing the lifecycle**: manual instruments are private (`createdByUserId`), but the FK is `on delete set null`. When deleting the user they would have become visible to **all** users (`visibleTo` = shared or own).

## `account-deletion` cron

- `GET /api/cron/account-deletion` (CRON_SECRET), every day at 03:30 (CronJob in the infra repo).
- Deletes users with `deletion_scheduled_at <= now`. If even a single user fails, the cron responds 500 and records `error`, so the `bb-cron-non-eseguito` alert (already `by (cron)`) reports it.
- The `gocardless-sync` and `net-worth-snapshot` crons skip deactivated users.

## Email

Via Resend, best effort:
- on deactivation, with the date and how to reactivate;
- after deletion.

## Exceptions to the "Operazioni lunghe" ("Long operations") standard

Export, reset and deletion are synchronous: only DB reads/writes for one user, a few seconds. Same reasoning as `categorize-apply` and the investments CSV import. To be reviewed if a user reaches hundreds of thousands of rows.

## Schema

Migration `0002_impostazioni_utente`: `auth_user.home_page` (text, default `/panoramica`) and `auth_user.deletion_scheduled_at` (timestamptz, nullable). In production it is applied by ArgoCD's `PreSync` Job.

## Knowingly deferred

- **Email change**: with magic link and Google a dedicated verification flow is needed.
- **Unlinking Google**: today you can only link.
- **Email notifications** (monthly summary, bank consent expiring).
- **Import of the JSON export**: the format is versioned (`EXPORT_FORMAT_VERSION`) precisely to make it possible.
- **Language**: arrives with i18n.
