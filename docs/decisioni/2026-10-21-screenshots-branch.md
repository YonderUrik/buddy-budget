# Landing screenshots on their own branch (2026-10-21)

After the history rewrite of 2026-10-21 (old JPEG screenshots removed, clone from 566 MB to 71 MB), 46 MB of the clone were still WebP screenshots, and every capture that changed them (the demo dates move every day) would have added ~20 MB again.

- The screenshots leave `main` (`landing/public/screens/` is ignored) and live on the `screenshots` branch: a single commit that the daily `landing-screens.yml` run replaces with a force-push, so the repository keeps one copy (~25 MB). No more bot PRs.
- `pnpm screens:pull` downloads them (dev, build, typecheck and test do it when missing; CI before the landing image); `pnpm screens:push` publishes a local capture on top of the branch for a PR that adds a screen.
- Back to a daily capture, since it no longer grows the repository.
- Still to do by hand: rewrite `main`'s history once more to drop the WebP screenshots committed between #467 and this PR (clone to ~25 MB + the branch).
