# Product country and language separated

- Persistent profile with `productCountry` and `language`: Italy it/en, Germany de/en. Migration 0036 keeps IT/it for existing accounts.
- Onboarding and Preferences allow the choice; the language governs copy and formats, the country governs the financial capabilities. Source catalogs in Italian with English and German translations.
- Germany: disabled pension/TFR (Italian severance pay), Italian tax calculations, forecast income, Analitiche/FIRE and Italian inflation, with checks on navigation, proxy, API and data loading. Actually recorded costs and taxes remain available.
- Changing country or language does not delete or rename the user's data. Only the initial categories during onboarding receive localized names and descriptions.
- To be integrated later: tax, pension and inflation models for Germany, with dedicated sources and checks. Translation of email communications and review of the legal notices are separate work from the interface language.
- Verification: production build, combination/capability tests, API guards, persistence and initial categories; landing catalog synced. Browser check of the DE product in de/en, pension block and switch to IT/en with modules restored. No deploy included.
