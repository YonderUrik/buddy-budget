# Landing screens: how they stay true

The app images seen on buddybudget.io are not drawn: they are **screenshots of the real app**, taken with sample data. This way the landing cannot show a screen the app does not have.

## How it works

1. **Sample data** (`scripts/demo-seed.ts`): creates in an empty database a fictitious user ("Giulia Demo") with accounts, ~300 transactions, investments, a mortgage and two loans. The numbers are deterministic (same result on every run) and the net worth history is calculated by the real code (`snapshotUser`). It refuses to run on a DB that contains other users.
2. **Real app**: `next build && next start` with `DATABASE_URL` pointing to that DB.
3. **Capture** (`landing/scripts/capture-screens.mjs`): Playwright opens every screen listed in `landing/content/screens.ts`, with a session cookie signed for the demo user, in light and dark theme, and saves `landing/public/screens/{light,dark}/<id>.jpg` plus `manifest.json`. The window is 1280 px wide at 1.5x and stretches to the page height (capped at 1500 px, or the screen's `maxHeight`); the dimensions go into the manifest and `AppShot` uses them. With `topCrop` it also saves `<id>-top.jpg`, only the first 800 px. With `phone` it also saves `<id>-phone.jpg`: the first screen at phone size (390×751 at 2x: an iPhone screen minus status bar and home indicator, so it fits whole inside the `PhoneFrame` component), used by the phone pinned at the top of the home page on mobile and by the «Com'è fatta» ("How it looks") gallery on the phone. With `PHONE_ONLY=1` it regenerates only these versions and keeps the full-size dimensions in the manifest. With `open` (dynamic routes, e.g. a security's page) it opens the given page and clicks the link with that text.
4. **Languages**: the screens exist in every interface language of the app (Italian, English, German). `DEMO_LANGUAGE=en|de pnpm demo:seed` seeds the same data with texts in that language (`lib/public-demo/texts.ts`; German also gets the German product rules, like a real German account), and `CAPTURE_LANGUAGE=en|de` captures into `landing/public/screens/<language>/` with its own `manifest.json`. Italian stays at the root of `public/screens/`. Other languages reuse the Italian heights, so every language of a screen has the same size; buttons, labels and demo names written in Italian in `screens.ts` are translated with the app catalogs before clicking. A screen the German account cannot open (Pension, Analytics: `unavailableIn` in `screens.ts`, checked against the app's country rules by `screens.test.ts`) is not captured in German and the landing shows the English one.
5. **Landing**: the `AppShot`, `PhoneShot` and `ScreenCrop` components render every theme × language version and the CSS shows one: the theme of the page and the visitor's language, which a script picks before the first paint from the browser languages (first supported one; English if none is supported; Italian without JavaScript) and stores in `<html data-screens>`. `?lang=en` or `?lang=de` forces a language, for checking. Hidden lazy images are never downloaded; only the Italian version of an above-the-fold image loads eagerly. The landing texts stay Italian.

## What prevents them from becoming false

- `landing/content/screens.test.ts` (runs in the landing CI): every screen must point to a route that exists in `app/(app)/` and have its images in every theme and language. If a route is renamed or removed, the test fails.
- A **visual** change to the app does not make anything fail: the capture must be rerun (below). Rule: whoever visibly changes a screen in the list regenerates the screenshots in the same PR.

## Regenerating the screenshots

You need Postgres, Redis and a Chromium with Playwright.

```bash
createdb bb_demo
export DATABASE_URL=postgresql://USER:PASS@localhost:5432/bb_demo REDIS_URL=redis://localhost:6379 \
  BETTER_AUTH_SECRET=<any secret> BETTER_AUTH_URL=http://localhost:3300 APP_URL=http://localhost:3300
pnpm db:migrate
pnpm demo:seed
pnpm build && pnpm exec next start -p 3300 &
for language in it en de; do
  DEMO_LANGUAGE=$language pnpm demo:seed
  (cd landing && CAPTURE_LANGUAGE=$language PLAYWRIGHT_MODULE=<path to playwright> pnpm capture:screens)
done
```

Italian goes first (the others take its sizes). One language alone also works, e.g. after changing only the English texts.

`BETTER_AUTH_SECRET` must be the same for the app and the capture (it signs the cookie). Optional variables: `DEMO_APP_URL`, `CHROMIUM_PATH`.

The GitHub workflow `landing-screens.yml` does the same steps on its own, in all three languages: it runs once a day (05:30 UTC), when the screen list, capture script or demo data change on `main`, or manually from Actions (not on every merge: with many PRs close together it was redoing everything each time), and opens/updates the `bot/landing-screens` PR with the new images. The PR is opened by `GITHUB_TOKEN`, so CI does not start on its own on it. It requires "Allow GitHub Actions to create and approve pull requests" in Settings → Actions → General. **It has not been run on GitHub yet.**

## Adding a screen

Add an entry to `SCREENS` in `landing/content/screens.ts` (id, area, real route, caption; `phone` if it is also needed in the home page on mobile, `open` if the route is dynamic, `unavailableIn` if a language's product country hides it), rerun the capture in every language and commit the images. If the screen needs data the seed does not create, extend `lib/public-demo/seed.ts`, with every new user-facing text in `lib/public-demo/texts.ts` (the seed fails on a text without a translation).
