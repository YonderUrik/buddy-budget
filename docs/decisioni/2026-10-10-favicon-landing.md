# 2026-10-10 — Landing favicon for Google

Diagnosis: the landing is online and indexable (no noindex, correct robots and sitemap), but `/favicon.ico` returned 404 and the only icon was a non-square SVG (viewBox 378×464).
Choice: `favicon.ico` (48/32/16), PNG 48/96/192, SVG made square and explicit `<link rel="icon">`, as Google asks (square, side a multiple of 48 px).
Limit: Google updates the favicon only at the next crawl, from days to a few weeks; it cannot be forced.
