# Indexing fixes after the Search Console report (2026-10-23)

The Coverage export of 2026-10-23 showed 15 pages not indexed against 2 indexed. Most (9) are "Discovered, currently not indexed": Google knows the URL but has not crawled it yet, normal for a young domain with few links, and the count grew because the landing gained pages (calculators, guide, features, then the English pages). The rest came from our side:

- `app.buddybudget.io/robots.txt` redirected to `/login` (the proxy did not treat it as public), so Google read the sign-in page as robots.txt and crawled the app: redirects and `noindex` pages in the report. Now public; rules `Disallow: /` with `Allow: /login` (Google must read its `noindex`).
- The landing's old app paths (`/login`, `/movimenti`…) were still 302 two weeks after the move: now 308.
- The sitemap gave every page the build date as `lastmod`: removed.
- Plain `http://` answers 200 instead of redirecting: fixed in Cloudflare ("Always Use HTTPS"), not in code.
