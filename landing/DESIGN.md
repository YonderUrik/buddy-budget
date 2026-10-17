# Landing design system

Durable visual rules of buddybudget.io (home, content pages, legal pages). The sign-in pages of the app follow the same world with Tailwind tokens. Written on 2026-10-17 with the «Un numero solo» home; update it when a rule changes, not for a one-off.

## World

The landing is the app's own interface language used to persuade: the same tokens, faces, radii and buttons as the app, so site, sign-in and app read as one thing. The device the home owns is the **sum**: ledger rows separated by hairlines and closed by a 2 px rule, adding up to one big figure with small muted decimals (the Panoramica's number style). The home opens on the **navy ground** (bar, title, sum card), with the Panoramica big and full width right after it, half on the navy (2026-10-17, after Hermes Agent: one colour as the world, tall light titles, a wordmark across the footer). Real screenshots of the app are the only imagery, in a browser-like window (`ScreenCrop`, cropped from the top at a fixed ratio) or in the CSS phone (`PhoneFrame`). No gradients, no illustrations, no glass, no icon-card grids as page structure.

## Tokens (`app/globals.css`)

- Ground `--bg` #f7f7f8 / dark #111113; surface `--surface`; text `--ink`, `--ink2`, `--ink3`; hairline `--line`.
- Primary `--primary` (teal, the app's) for the main button, links and focus; `--accent` for tinted icons and highlighted text.
- `--navy` for the closing, the footer and the «Sotto il cofano» panel, with `--on-navy`/`--on-navy2` text.
- `--sun` (brand yellow) for the main button (`.btn.sun`: «Inizia gratis» in the bar, the opening, the closing and the phone bar) and as a small mark (the «=» badge, the yellow kicker on navy heads). Never as a large surface. In the app the same yellow is the `sun` button variant, the active nav marker and the sign-in main button.
- `--a-pos`/`--a-neg` only beside real figures (gain, debts).
- Radii: `--r-sm` 8, `--r` 11 (controls), `--r-card` 16, `--r-lg` 20 (large panels).
- Faces: Sofia Sans Extra Condensed (`--f-d`, weight 300–400) for the big titles (home h1 and h2, panel and place hooks, content-page h1, closing, footer wordmark); Space Grotesk (`--f-h`) for figures and small titles; Hanken Grotesk (`--f-b`) for text; Geist Mono (`--f-m`) for code and for the `.idx` labels in spaced capitals (only the four places: «01 · Banca»).

## Type scale

- h1 (home) `clamp(60px, 8.4vw, 124px)` (16vw on phones) in `--f-d` weight 300, line-height 0.9.
- Section h2 `clamp(44px, 5.6vw, 80px)` (42–56 on phones) in `--f-d` weight 300, no label or intro line above or below.
- Row h3 20–24 px; body 16–17 px, line-height 1.5–1.65, max 58–66ch; technical `spec` lines 13.5 px in `--ink3`.
- Figures: `.amt` tabular, tracking −0.04em, `small` at 0.5em muted for decimals and units.

## Layout and rhythm

- `.wrap` max 1200 px, 24 px gutters (20 on phones). Sections `.sec` 88 px padding (64 / 52 on phones), separated by a hairline, never by a grey band.
- Lists are rows with hairlines (`.places`, `.facts`, `.sum-rows`, FAQ rows), two columns on desktop where the items are short, one column under 1000 px.
- Cards only for the sum card, the showcase panels on the phone and the calculators.
- Every tap target at least 44 px; links in the phone menu 58 px.

## Copy

- Headline first, 5–7 words, everyday Italian: say what happens, not how it is built. One sentence under it.
- Technical facts come right after, smaller, never in the headline: that is how the page speaks to both registers.
- Only facts verifiable in the product, the infra repo or a cited source; figures from the demo screenshots, labelled as a made-up person. No user counts, reviews or promises.

## Motion

- One orchestrated moment on the home: the sum card's rows appear one at a time while the total counts up (≤ 1.2 s), once, when the card is in view. Hidden states exist only under `html.js-motion` (set before paint); with `prefers-reduced-motion` everything is visible at rest.
- Otherwise only state transitions under 300 ms (tabs, buttons, the phone bar). Entrances via `Reveal` only on the features page.

## Components

- `components/home/`: `Hero`, `SumCard`, `Sources` (four rows), `Showcase` (tabs + snap track), `Trust` + «Sotto il cofano», `Faq`, `Closing` (shared with `ContentPage`), `MobileCta`.
- `SiteNav`: navy bar on every page (links in spaced capitals, yellow «Inizia gratis»), links in a full-screen sheet under 1000 px, «Entra» and «Inizia gratis».
- `SiteFooter`: navy, the «BuddyBudget» wordmark across the whole width, then the links.
- `CopyCommand`: terminal block with the self-hosting commands and a copy button (`self_host_command_copied`).
- `ContentPage`: a navy head (back link, yellow mono kicker, tall h1, lead), then body, tax notice, the navy `Closing`. `LegalPage` has the same navy head with the version line.
- No filler lines: no trust lists, «free during the beta», schedules («ogni mattina»), section intros or captions that only restate the title. If a line doesn't change what a visitor understands, it goes.
