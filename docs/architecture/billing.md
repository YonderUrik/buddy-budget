# Plans and billing (Free and Pro)

This part decides what an account can open: the **Free** plan (Liquidità: accounts, movements, analysis, categories, rules, subscriptions, imports, settings, help) or **Pro** (every section). Pro is a Stripe subscription at 1,99 € a month or 20 € a year with a 14-day free trial once per person, or a free grant (owner, launch, access code). Code: [`lib/billing/`](../../lib/billing/) (logic), [`app/api/billing/`](../../app/api/billing/) and [`app/api/stripe/webhook/`](../../app/api/stripe/webhook/) (routes), [`components/domain/billing/`](../../components/domain/billing/) (UI), `/pro` and Settings → Piano (screens).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

```text
Checkout (Stripe hosted page) ──► webhook ──► billing_subscriptions ─┐
access code / CLI grant ─────────────────────► billing_grants ───────┼─► computeEntitlement ──► auth_user.pro_until / pro_source
                                                                     │                                  │
                       status?refresh=1 (self-heal) ─────────────────┘                     session (every request)
                                                                                                        │
                                                         proxy: country gate ──► plan gate (402 / redirect to /pro?da=…)
```

| Piece | Code |
|---|---|
| Which mode applies (`off` / `pilot` / `on`), Stripe keys | [`config.ts`](../../lib/billing/config.ts) |
| Prices, trial, grace periods | [`plans.ts`](../../lib/billing/plans.ts) |
| Which paths need Pro | [`plan-routes.ts`](../../lib/billing/plan-routes.ts) |
| Pro until when, from what | [`entitlement.ts`](../../lib/billing/entitlement.ts), [`sync.ts`](../../lib/billing/sync.ts) |
| Free or Pro for a session | [`plan-for-user.ts`](../../lib/billing/plan-for-user.ts), [`access.ts`](../../lib/billing/access.ts) |
| Checkout and Customer Portal | [`checkout.ts`](../../lib/billing/checkout.ts) |
| Webhook events | [`webhook.ts`](../../lib/billing/webhook.ts) |
| Grants and access codes | [`grants.ts`](../../lib/billing/grants.ts), [`access-codes.ts`](../../lib/billing/access-codes.ts) |
| Emails (trial ending, subscription ended) | [`emails.ts`](../../lib/billing/emails.ts) |
| Account deletion and deactivation | [`lifecycle.ts`](../../lib/billing/lifecycle.ts), called from `lib/account/lifecycle.ts` |
| Owner CLI | [`lib/db/billing-admin.ts`](../../lib/db/billing-admin.ts) (`pnpm billing:*`) |

## 2. Principles

- **Fail-safe.** Billing applies only with `BILLING_MODE=pilot|on` **and** every Stripe value set, and never on a self-hosted install. Anything missing means `off`: everyone has everything. Nobody gets locked out of a feature they could not pay for.
- **One gate, after the country gate.** [`proxy.ts`](../../proxy.ts) checks `isCountryPathAvailable` first, then `isPlanPathAvailable`: a screen a country does not have is never offered as Pro. The navigation uses the same order (`withCountryLocks`, then the plan's `navLocks`, from PR #465).
- **Stripe is the source of truth.** Each webhook re-reads the subscription from Stripe instead of trusting the event body, so order and duplicates do not matter. Processed event ids are stored (`billing_stripe_events`).
- **Denormalised for speed.** The result is written on `auth_user.pro_until` and `pro_source`; the proxy reads them with the session, no extra query per request.
- **No purchase in the phone app.** The Capacitor shell shows the plan but no checkout, portal or code form (App Store and Play rules): a subscription bought on the website works there.
- **Nothing is deleted on Free.** Pro data stays; the sections are closed until Pro comes back.
- **The public demo is always Pro.**

## 3. Data model

Migration `0050_billing` (after main's `0049_budget_rollover`).

| Table | What it keeps |
|---|---|
| `billing_customers` | one Stripe customer per user, `trial_used_at` (trial once per user) |
| `billing_subscriptions` | status, interval, `current_period_end`, `trial_end`, `cancel_at_period_end`, kept after they end |
| `billing_grants` | free Pro: `source` `admin` / `launch` / `code`, start, end (null = for good), `revoked_at` |
| `billing_access_codes` | SHA-256 of the code (the code itself is shown once), label, duration, max redemptions, expiry |
| `billing_stripe_events` | id and type of each processed webhook event |
| `auth_user.pro_until`, `pro_source` | result of the entitlement (`subscription`, `trial`, `grant`) |

No card data, no amounts, no invoices: Stripe holds those.

## 4. Entitlement

`computeEntitlement` takes every subscription and grant of a user; the latest end wins.

- `trialing` and `active`: until `current_period_end` + 48 hours (a late renewal webhook never locks anyone out).
- `past_due` (card refused, Stripe retrying): until `current_period_end` + 7 days.
- `canceled`, `unpaid`, `paused` (trial ended without a card), `incomplete*`: nothing.
- A grant counts from `starts_at` to `ends_at` (null = 9999-12-31), unless revoked.

**Worked example.** Anna starts the yearly plan on 1 March with the trial: Stripe says `trialing`, period end 15 March → `pro_until` = 17 March, source `trial`. On 15 March the card is charged: `active`, period end 15 March next year → `pro_until` = 17 March next year, source `subscription`. She also redeems a 30-day code on 1 April: the grant ends 1 May, earlier than the subscription, so nothing changes. She cancels in June: `cancel_at_period_end`, still `active`, same `pro_until`; at period end Stripe sends `customer.subscription.deleted` → no source left → Free, and she gets the «subscription ended» email.

## 5. Flows

- **Checkout** (`POST /api/billing/checkout`, interval `month` or `year`): creates the Stripe customer if needed (idempotency key per user), opens a hosted Checkout with the trial if `trial_used_at` is empty, card required, the subscription cancels if no payment method is there at trial end, promotion codes allowed. Back on `/pro?checkout=success`, the page polls `GET /api/billing/status?refresh=1` every 2 seconds until Pro appears (30 seconds, then a «takes a little longer» line).
- **Portal** (`POST /api/billing/portal`): Stripe Customer Portal for card, invoices, switching interval and cancelling.
- **Webhook** (`POST /api/stripe/webhook`, signature checked): `checkout.session.completed`, `customer.subscription.created` / `updated` / `deleted` / `paused` / `resumed` / `trial_will_end`, `invoice.paid`, `invoice.payment_failed`. Every other event is ignored.
- **Self-heal**: `status?refresh=1` re-reads the user's subscriptions from Stripe (20-second cooldown on Redis), so a lost webhook is fixed the next time the user opens the plans page.
- **Access codes**: `pnpm billing:code --label … [--days N] [--uses N] [--expires DATE]` prints a code like `BB-7KQ2-M9XP` once. `POST /api/billing/redeem` (10 attempts an hour per user) adds a `code` grant, once per user per code.
- **Owner CLI**: `pnpm billing:stripe-setup [--live]` creates product, prices and portal configuration and prints the env values; `billing:grant` / `billing:revoke` give or take Pro by email; `billing:grant-existing --until DATE [--dry-run]` gives the existing accounts a `launch` grant.
- **Plans page** (`/pro?da=<area or place>`): the navy Pro card carries the purchase block (yearly and monthly as two price tiles, yearly selected, the trial button); Free sits beside it on desktop and under it on the phone. A Free account arriving from a locked section reads what that section gives (`AREA_PITCH`). Settings → Account shows the plan as one block with one action.
- **Invitations to Pro** (`useProUpsell`, `ProMenuCard`, `ProNudge`): only for a Free account where plans apply, never in the native app, on self-hosted installs or in the public demo. Places: a card under the menu items in the sidebar (a yellow icon when collapsed), the top of the phone's «Altro» sheet, a block at the end of Liquidità → Conti and → Analisi (closable for 30 days in that browser, `localStorage`), the Settings plan block. Each links to `/pro?da=<place>`; the button says «Prova 14 giorni gratis» while the trial is available.
- **Landing**: a «Prezzi» section on both homes (`/#prezzi`, `/en#pricing`, in the menu) from `landing/content/pricing.ts`, whose prices `lib/billing/landing-prices.test.ts` keeps equal to `PRO_PRICE_CENTS` and `PRO_TRIAL_DAYS`. Until Pro is turned on it says that everything is unlocked; lines on pension and taxes follow the visitor's country (`data-needs`).
- **Account**: deactivation sets `cancel_at_period_end` (reactivation clears it); deletion deletes the Stripe customer first, which ends its subscriptions; an account with a paid subscription is never deleted for inactivity.

## 6. Configuration

| Variable | Meaning |
|---|---|
| `BILLING_MODE` | `off` (default), `pilot` (only `BILLING_PILOT_EMAILS`), `on` |
| `BILLING_PILOT_EMAILS` | comma-separated emails for `pilot` |
| `STRIPE_SECRET_KEY` | secret or restricted key; `sk_test_`/`rk_test_` = test mode |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` of the endpoint `https://app.buddybudget.io/api/stripe/webhook` |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | price ids from `billing:stripe-setup` |
| `STRIPE_PORTAL_CONFIGURATION` | optional `bpc_…` |

The boot log `app.billing.configured` says the mode in one line (`billing=pilot stripe=test pilot=2`), never keys or emails.

## 7. Observability

- Logs: `billing.webhook.handled` / `failed` / `invalid_signature`, `billing.subscription.synced` / `unknown_user`, `billing.payment.failed`, `billing.checkout.created` / `rejected` / `failed`, `billing.portal.opened` / `failed`, `billing.code.redeemed` / `rejected`, `billing.email.sent` / `failed`, `billing.customer.deleted` / `delete_failed`, `billing.refresh.failed`, `billing.plan.blocked` (with `proArea`).
- Metrics: `buddybudget_billing_webhook_events_total{type,outcome}`, `buddybudget_billing_actions_total{action,outcome}`, `buddybudget_plan_blocks_total{area,kind}`, `buddybudget_accounts_pro{source}`.
- Umami: `pro_page_viewed` (`from`: area or invitation), `pro_lock_opened`, `pro_nudge_opened` / `pro_nudge_dismissed` (`place`), `pro_checkout_started`, `pro_activated`, `pro_portal_opened`, `access_code_redeemed`.

## 8. Limits

- One price per interval, in euro, for every country; VAT is «included where due» and depends on the seller's tax position (Stripe Tax not configured).
- No in-app purchase on iOS or Android.
- No family or shared plan; no coupons created from the app (Stripe promotion codes work in Checkout).
- Going live needs the owner's tax position, a verified Stripe account and live keys: see [`docs/decisioni/2026-10-19-piani-gratis-e-pro.md`](../decisioni/2026-10-19-piani-gratis-e-pro.md).

## 9. Tests

Unit: `lib/billing/{config,access,entitlement,plan-routes,access-codes,subscription-map,landing-prices}.test.ts`, `components/domain/billing/plan-status.test.ts`. Integration (real database, Stripe mocked): `lib/billing/billing.integration.test.ts`. Proxy: "proxy with the Free and Pro plans" in `proxy.test.ts`.
