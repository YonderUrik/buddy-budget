# 2026-10-27 — Fixes before the Show HN

A simulated Hacker News review of the launch post found public contradictions and details a reader would use against the project. Fixed:

- **README**: the demo link opens the Italian profile (`/demo?country=IT&lang=en`). Without `country`, a visitor from the US gets the `OTHER` demo, where Pension is «Coming soon» and the tax tab is closed: the post is about Italian taxes. The status line says how the code is written (two developers, Claude Code, tested pure functions in `lib/calc/`) instead of «mostly by one developer», matching the post.
- **English landing FAQ**: «Which countries and languages?» no longer says banks «can be connected» in five countries two answers before «Does it connect to my bank? Not yet».
- **Security page, «What it decides»** (it/en): «It suggests, it doesn't decide» contradicted the 70% automatic categories described right after it. Now it says what applies by itself, what waits for the user, and that with the option off no suggestion applies.
- **Marketing skills out of the public repository**: the 27 skills from `coreyhaines31/marketingskills` and `.claude/product-marketing.md` (decision of 2026-10-17) moved to the project files (`marketing-skills/skill-dal-repo/`), where sessions of the project still read them. `taste-skill` stays, because `landing/DESIGN.md` uses its checks.
- **CHANGELOG sections in English** (`Features`, `Bug fixes`, `Performance`…) from the next release; older entries stay as they are.

Not done here: a CSV column mapper that works without AI (opened as a `help wanted` issue), and the demo opening on Italy by default for English visitors (the per-country demo of 2026-10-19 stays).
