# Rollback of the localization (#361)

- At the user's request, the localization introduced by PR #361 is withdrawn: interface and behaviour return to the previous Italian product, without country/language selectors or active German modules.
- The additive migration 0036 and the country/language fields remain in the schema, unused, to preserve data and the history of migrations possibly already applied. No DROP and no direct change to the production database.
- Only two independent build fixes kept: financial constants without database dependencies in browser components and removal of the unsupported export from the auto-categorized route.
- The subsequent unpublished work on the country registry/German inflation remains on the `codex/germany-inflation` branch; it is not integrated by this rollback. Resume the localization only after a new check and request from the user.
