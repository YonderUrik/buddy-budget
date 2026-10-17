# Example data in the user's language

«Esplora con dati d'esempio» now writes account names and transaction descriptions in the interface language (Italian, English, German); amounts, dates and categories are identical in every language. When the user changes language in Settings, the demo texts are rewritten; a name or description the user edited stays as it is.
The demo now finds its categories by their stable default key instead of the Italian name: before, a user whose categories had been translated in onboarding (English or German) got the two demo accounts with no transactions at all.
The demo errors (start refused, adding real data while the demo is active) are translated too.
Real user data is never touched. The German demo texts were written by Claude and not reviewed by a native speaker. The `pnpm demo:seed` dataset used for the landing screenshots stays Italian, like the landing.
