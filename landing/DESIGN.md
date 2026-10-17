# Landing design system

Durable visual rules of buddybudget.io (home, content pages, legal pages). The sign-in pages of the app follow the same world with Tailwind tokens. Rewritten on 2026-10-17 with taste-skill (`.claude/skills/taste-skill/`, direction «Type and nothing else»); update it when a rule changes, not for a one-off. Check every change with the skill's `lint.mjs` and `inspect.mjs`.

## World

Type and colour carry the page; pictures arrive later, large and few, and they are always real screenshots of the app, shown as they are (no device frame, no browser bar). The page is a stack of **colour fields** (`data-field` on each section: `navy`, `light`, `alt`, `sun`); the change of field is the only separation. No rules or hairlines between sections, no 1 px boxes, no shadows at rest, no gradients, no glass, no icon-card rows, no eyebrow labels, no numbered labels, no monospace outside code. The home's own device is the **sum**: the four places at display size, a thick bar, the net worth.

## Tokens (`app/globals.css`)

- Ground `--bg` #f7f7f8 / dark #111113, `--bg-alt` one tone step; surface `--surface`; text `--ink`, `--ink2`, `--ink3` (running text in `--ink`; `--ink2` for secondary lines, `--ink3` only for decimals and captions).
- `--navy` field for the opening, content heads, the closing and the footer, with `--on-navy`/`--on-navy2`.
- `--sun` (brand yellow): the sign-up button everywhere, the second line of the home title, one full field on the home («Il netto, prima di vendere»), the calculators' result panel and the language bar. On the yellow field the sign-up button in the bar turns ink.
- `--primary` (teal) for focus rings and the app's primary; `--a-pos`/`--a-neg` only beside real figures.
- Two faces: Sofia Sans Extra Condensed (`--f-d`, 300–400) for titles and figures; Hanken Grotesk (`--f-b`, `--f-h` is its alias) for everything else. `--f-m` is the system monospace, for code blocks only. No `tabular-nums` on the display face (it spreads the digits).

## Type scale

- Home h1 `clamp(68px, 12.4vw, 196px)`, two lines, line-height 0.84; on phones 19vw.
- Section h2 `clamp(52px, 7vw, 112px)` (44–64 on phones); content-page h1 `clamp(56px, 8vw, 128px)`.
- Big figures 72–232 px in `--f-d`; decimals in `small` at 0.4–0.5em, muted.
- Body 17 px / 1.55; small 14–15 px. Headings never wrap past two lines.

## Layout and rhythm

- `.wrap` max 1280 px, 32 px gutters (20 on phones). Sections `.sec` 128 px padding (88 on phones).
- Each set piece sits differently: statement full width; the sum list left to right; tabs with the screen on the right; two figures side by side; a table; questions indented by a quarter under a wide heading; the close with the button at the bottom right.
- Rows and blocks separate by tone steps (`color-mix(... var(--ink) 4–9% ...)`), radius 14–28 px. Tables have alternate rows on a tone step, no lines.
- Buttons are flat pills (`.btn.sun`, `.btn.ink`, `.btn.line`, `.btn.big`); text links have a 2 px underline that tightens on hover (`.tlink`, `.more`). Every tap target at least 44 px.

## Copy

- Headline first, 5–7 words, everyday Italian: say what happens, not how it is built. One sentence under it.
- Technical facts come right after, smaller, never in the headline: that is how the page speaks to both registers.
- Only facts verifiable in the product, the infra repo or a cited source; figures from the demo screenshots, labelled as a made-up person. No user counts, reviews or promises. No filler lines.

## Motion

- Home title: each line rises out of its own mask on first paint (0.8 s, 90 ms apart).
- Entrances: blocks marked `data-rise` rise 24 px and fade in when they come into view (`RiseObserver`), staggered 75 ms by `rise(i)`. Hidden states exist only under `html.js-motion` (set before paint).
- The bar takes the colours of the field under it (300 ms, `useFieldUnderBar`). The first picture drifts slightly with scroll (scroll-driven, where supported). Controls answer hover and press in under 200 ms.
- `prefers-reduced-motion`: everything visible at rest, no drift, no loops.

## Components

- `components/home/`: `Hero`, `SumList` (the live sum: amounts are fields; `sum_edited`, `sum_reset`), `Showcase` (tabs + snap track, desktop screen or phone capture), `TaxCompare`, `Trust` (table + the code and `CopyCommand`), `Faq`, `Closing` (shared with `ContentPage`).
- `SiteNav`: sticky, colour by chapter, sentence-case links; full-screen navy sheet under 1000 px.
- `SiteFooter`: navy, three columns, the wordmark across the width cut by the bottom edge.
- `ScreenCrop`, `AppShot`, `PhoneShot`: real screenshots with rounded corners and nothing else.
- Calculators (`.tool`): one block on `--bg-alt`, the result on the yellow field with the key answer big in `--f-d`.
- `ContentPage`: navy head (back link, h1, lead), body on the light field, tax notice, the navy `Closing`. `LegalPage` has the same navy head.

## Languages

- Italian at the root (`app/(it)/`, `<html lang="it">`), English under `/en` (`app/en/`, `<html lang="en" data-screens="en">`): two root layouts, so switching language is a full page load. English pages: home, `/en/security`, `/en/features`, `/en/features/investments`, `/en/screens` (pairs in `content/locales.ts`, which also builds hreflang it/en/x-default).
- Copy lives per language: `content/en/*`, `content/ui.ts` (nav, footer, shared strings), `content/screen-text.ts`, and the `en` text of each catalog entry in `lib/features/catalog.ts`. Components take the content and a `locale` prop; they never hardcode a language.
- English copy is plain American English written for the page, not translated line by line; Italian tax terms keep their name with a short explanation (zainetto fiscale, bollo). Calculators, guides and legal pages stay Italian-only and are always labelled «(Italian)» from English pages.
- «IT / EN» switch in the nav (from 1000 px), the phone menu and the footer; it goes to the same page in the other language, or to that language's home. The Italian home shows a yellow bar «This page is also available in English» only to browsers that don't prefer Italian (set before paint, dismissible, remembered in localStorage). Never an automatic redirect.
- «Prova la demo» / «Try the demo» sits next to the main button in the opening and the closing and opens the app's public demo (`/demo`, `?lang=en` from English pages).
