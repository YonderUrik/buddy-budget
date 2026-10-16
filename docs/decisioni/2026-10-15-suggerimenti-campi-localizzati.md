# Localized field hints

Fixed the static placeholders that were passed without translation in categories (search, selection and description), support and the sign-in email. Translations that already existed are now also applied to fallback texts and to the accessible labels of the picker.
Numeric placeholders for subscriptions and loans use the format of the chosen language. Names and descriptions entered by the user stay unchanged.
No new feature and no catalog change: a fix to localization that was already declared. No re-enabling of the suspended German features.

Verification: production build/TypeScript, lint and 5 localization tests passed. Browser EN/DE/IT: three support types, category description and search in the picker, subscription amount and the sample email on the login checked. No new data stored.

Landing audit: the site is still Italian-only (content, calculators, screenshots and metadata), separate from the app's localization. Removed the outdated FAQ «solo italiano/euro» ("Italian/euro only") and added an explanation of languages, countries and the reduced scope for Germany. Full translation of the landing is still to be implemented.
