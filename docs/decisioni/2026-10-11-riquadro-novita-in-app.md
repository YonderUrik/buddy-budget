# In-app «Novità» ("What's new") strip

Date: 2026-10-11

- **Decision**: new features are announced with a panel in the Panoramica (one item at a time, dismissible), not with an email to everyone: the promotional email requires a dedicated legal basis and privacy text, to be reviewed with a professional. The `featureAnnouncementEmail` draft stays in the repo, not wired to any sending.
- **Hand-curated**: `lib/whats-new/entries.ts` contains only the features that deserve an item, not every release. An item stops appearing after 45 days; dismissal is remembered per device (localStorage).
- **Why localStorage**: it avoids a migration and an extra request; the limit is that whoever changes device sees it again.
- **Postponed**: dismissal tied to the account, page listing all what's-new items, sidebar item, email announcement with a dedicated preference.
- **Landing**: no impact. **Performance**: no heavy JS added, no images; the strip appears after hydration and before the data, so without shifts.
- **Update**: after the first round the item became a one-line strip (no image or long text; the explanation is in the link's `title`) to be unobtrusive. Postponed: sidebar item or page with all what's-new items.
