# Landing: a named founder, `/about`, release counts and `/changelog` (2026-10-24)

A site audit (heycatch.ai, finding D3 «Trust signals and social proofs», 3/20) found no human proof on the landing: no user count, no testimonial, no named founder, no third-party or dated signal. Pre-launch there are no users, reviews or press, so nothing of that kind is invented. What changed:

- **Named founder**: «Dietro c'è una persona, Daniele Roccaforte, a Torino» in the home's code section, with links to `/about`, the GitHub profile and the changelog. The name was already public as data controller. No photo and no LinkedIn/X until Daniele chooses to show them.
- **`/about` and `/en/about`** (English route by the 2026-10-19 rule), linked from the footer: why it exists (from the README, not a first-person story), how it is made, since when, contributors by GitHub handle, who answers for the data, contacts.
- **«Ancora niente iscritti da contare»** above the FAQ, where the audit asked for a usage counter: it says there are no users to count yet and shows the counts that are true (releases, releases with a new feature, date of the latest), read from `CHANGELOG.md` at build time (`landing/lib/changelog.ts`). The image build copies `CHANGELOG.md` into the context; without it the block hides.
- **`/changelog` and `/en/changelog`**: every release with its date and its feature/fix lines (dependency bumps and refactors left out), linked from the footer next to the service status and from the code section.

Deferred, waiting on Daniele: testimonials from beta users (only real quotes, with permission), a real usage count after launch, Show HN / Product Hunt mentions after 10 and 17 November, a photo or professional profile link, the «why I built it» story in his own words.
