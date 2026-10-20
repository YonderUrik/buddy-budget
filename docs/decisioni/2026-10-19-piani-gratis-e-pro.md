# Free and Pro plans with Stripe (2026-10-19)

Data: 2026-10-19

**Decision** (Daniele): the Free plan opens only Liquidità; Pro opens everything, no limits, at 1,99 € a month or 20 € a year with a 14-day free trial once per person (card required). This replaces the 2026-10-11 idea of a mandatory subscription during onboarding. Free grants (owner, launch, access codes) give Pro without paying. Self-hosted installs have everything, always.
**How**: Stripe Checkout and Customer Portal, webhooks re-read the subscription from Stripe, the result lives on `auth_user.pro_until`. The plan gate sits in the proxy after the country gate and reuses the locked-menu mechanism of PR #465. No purchase in the phone app (store rules). Details: [`docs/architecture/billing.md`](../architecture/billing.md).
**Off until the owner turns it on**: `BILLING_MODE` defaults to `off`; without every Stripe value it stays off. Terms and Privacy already describe the plans (version 2026-10-22).
**Blocks going live**: the owner's tax position (no P.IVA yet, Fiscozen planned) and the seller's details in the Terms, a verified Stripe account, live keys and webhook secret as SOPS secrets, `BILLING_MODE=pilot` then `on` in the app Deployment, a professional review of the Terms (withdrawal, renewal), and the launch grant below.
**Existing users** (Daniele, 2026-10-20): every account that exists when Pro is turned on gets 3 months of free Pro: on that day run `pnpm billing:grant-existing --until <launch date + 3 months>` (first with `--dry-run`).
