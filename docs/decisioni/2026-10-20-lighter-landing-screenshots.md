# Lighter landing screenshots (2026-10-20)

The repository weighed 517 MB to clone, 497 MB of which were old versions of `landing/public/screens/`: the screenshot bot ran several times a day and rewrote ~250 images each time (~30 MB), often only because the build version in the sidebar or the demo dates had changed.

- Screenshots are WebP (quality 0.8, encoded by Chromium in `capture-screens.mjs`): 41 MB → 23 MB in the tree, lighter pages on the landing.
- The sidebar build version is hidden in captures (`data-capture-hidden`); unchanged images are not rewritten and a run with nothing new leaves no diff.
- `landing-screens.yml` runs weekly (Monday) instead of daily, plus on screen-definition changes and by hand.
- Not done: rewriting git history to drop the old images (clone under 40 MB). It needs a force-push to `main` and every open PR realigned, so it waits for Daniele's go.
