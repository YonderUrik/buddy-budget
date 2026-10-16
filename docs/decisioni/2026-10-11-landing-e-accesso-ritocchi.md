# Landing and sign-in: tweaks after Daniele's test (2026-10-11)

- **Opening**: «Foglio1» ("Sheet1") and «BuddyBudget» alternate on their own, with a bar filling below the active tab; they stop on mouse hover or off screen, stop at the first click and do not start with «riduci movimento» (reduce motion). In app view the formula bar shows net worth and the app's address. The Panoramica is no longer cropped.
- **Screenshots**: the capture stretches the window to the page height (cap 1500 px, 1200 for Movimenti, 1000 for the Simulation) and saves the dimensions in the manifest; `AppShot` uses them to reserve space. The opening uses `panoramica-top.jpg`, only the top part.
- **App tour**: instead of pill tabs, a numbered index of the areas on the left (on phone a two-column grid), not sticky.
- **Screens on phone**: each area is a row with its screens wrapping, no more sideways-scrolling strip.
- **Sign-in**: title «Entra in BuddyBudget» ("Sign in to BuddyBudget"); instead of the «Cosa c'è dentro», «Novità» and «In arrivo» tabs, a sample accounts sheet that row by row becomes BuddyBudget's (`AuthSheetExample`). Removed the Umami event `login_sheet_tab_selected` and the login's link to the catalog.
- **Other**: Italian rules readable on phone, «Rata N pagata» ("Instalment N paid") without «0,00 €» when the instalment has no amount, demo seed aligned with the new categories (Freelance → Altre entrate).
