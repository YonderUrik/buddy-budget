# Completeness of the app's translations

- Fix on the `codex/localization-completeness` branch, based on PR #361 restored only for the local test; no merge or deploy.
- English/German catalogs extended to help texts, dynamic messages, forms, imports, notifications and confirmations; date and number formatting tied to the explicit language, without mutable global state.
- The country keeps its own capabilities independent of the language. Taxation, pension and other features not yet implemented for Germany remain blocked; no new financial rule or migration.
- Identifiers, form values and API parameters stay stable. Names and descriptions entered/imported by users must not be renamed when changing language.
- Verification on an isolated demo database: 35 routes in IT/en, DE/de and DE/en (105 navigations), forms and help in the four combinations; tests of placeholders and message coverage, language isolation and heatmap calculations. 2,204 tests pass; the suite has a pre-existing error in the logger test due to the name `mario` in the stack's local path.
- No new observable signal or catalog feature; the client catalogs grow in size. Before the merge: user test; afterwards continue integrating country-specific rules separately.

### Default categories (fix after the test)

The categories provided by the app must follow the language even after onboarding. Migration 0037 adds `default_key`, set by the seed and kept by onboarding for the translated default names. The backfill of earlier rows requires a match of known name, type, icon, description and fallback flag; it does not change names or links. Since the previous schema did not record the origin, a category recreated by hand with all the same attributes is indistinguishable from a default one. New categories created by hand never have this key.

The client query projects names and descriptions in the current language/product, leaving saved data and IDs unchanged. An explicit rename removes the key; saving the translated name already shown does not count as a rename. Custom descriptions stay intact. The fallback is translated through its flag. Accounts and transaction descriptions remain user data: they are not translated because they happen to match a catalog entry.

Verification: tests of the four product/language combinations, return to the original language, custom names equal to the catalog ones, per-country descriptions, translated onboarding and modified names. Browser check on cash, categories and analysis and saving of a translated name. The Italian screens already regenerated keep the same texts.

Outcome of the categories fix: build and TypeScript successful; 76 targeted tests passed; 12 page/profile combinations verified in the browser without errors, including saves without rename. The full suite before the last regression test showed the known logger error and an onboarding fixture without the new identity: fixture fixed and all affected tests rerun successfully. No merge or deploy; local preview in Italy/English.
