# Instagram link in the landing footer (2026-10-24)

- Daniele asked for a discreet reference to the brand's social profiles; today there is only Instagram (`https://www.instagram.com/yourbuddybudget/`).
- One footer line «Instagram» with a small glyph, under the GitHub link, on every page in Italian and English. No banner, no follow buttons, no embedded feed.
- The URL lives in `INSTAGRAM_URL` (`landing/content/site.ts`) and is also the `sameAs` of the Organization structured data (with the GitHub repository when public), so search engines tie the profile to the site.
- Umami event `social_link_click` (`network: "instagram"`, `location: "footer"`) to see whether anyone follows it.
