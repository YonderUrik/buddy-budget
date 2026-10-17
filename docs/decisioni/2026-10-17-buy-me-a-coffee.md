# 2026-10-17: Buy Me a Coffee link on GitHub and in the app

Daniele opened a Buy Me a Coffee page (https://buymeacoffee.com/yonder) to accept voluntary donations while the service is free.

- GitHub: `.github/FUNDING.yml` (`buy_me_a_coffee: yonder`) shows the «Sponsor» button on the repository; README has a badge and a line under "Contributing, security and contacts".
- App: «Offrimi un caffè» in the avatar menu (desktop), in the «Altro» menu (phone, under Assistenza) and as a «Sostieni BuddyBudget» section at the end of «Aiuto e segnalazioni». The URL lives in `DONATION_URL` (`lib/support/constants.ts`).
- Observability: Umami event `donation_link_opened` with `source` (`aiuto`, `menu_utente`, `menu_altro`). No server signal: the link is external.
- Hidden inside the native app (Capacitor shell, PR #404): App Review has rejected external tip links to the developer under guideline 3.1.1 (tips must go through in-app purchase), and Google Play has a similar billing rule. `useShowDonationLink()` (`lib/support/donation.ts`) checks `window.Capacitor`; switch it to `nativePlatform()` from `lib/native` once #404 lands.
- Kept low-key on purpose: no banner or prompt in the main screens, the app stays free. Not on the landing for now (the landing thread owns `landing/`).
- Donations are personal gifts, not a sale; if they become regular income they go into the P.IVA discussion with the commercialista.
