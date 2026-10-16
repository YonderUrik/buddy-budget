# «Novità» ("What's new") as a label next to the date

Date: 2026-10-11

- **Decision**: the «Novità» strip above the chart (title + «Provala →», "Try it →") is replaced by a label in the Panoramica header, next to the date: «✦ Novità: <titolo>». Chosen by Daniele between two trials on the real app (the other was a sentence at the end of the month's narrative).
- **Motion**: it enters after the greeting, the sparkle turns once and a sheen crosses the text twice, then it stays still (`.text-sweep-once`, CSS only). With reduced motion it is static text.
- **Explanation**: tapping it opens a popover (bottom sheet on phone) with the summary, the button to the feature and «Non mostrare più» ("Don't show again"). New Umami event `whats_new_opened`; `whats_new_clicked` and `whats_new_dismissed` remain.
- **Postponed**: list of all what's-new items, dismissal tied to the account.
