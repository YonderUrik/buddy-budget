# 2026-10-11 — Landing redirects without the internal port

From the Search Console export: folder redirects (`/guide` → `/guide/`) left the landing's nginx with `:3000` in the URL, and `/funzioni/` gave 403.
Choice: `absolute_redirect off`, trailing slash removed with a 301 (`/funzioni/` → `/funzioni`), `try_files` without directory listing.
The `noindex` reported by Google concerns the draft legal pages (indexable today) and the app login (intended); `www` → apex and `/login` → app remain intended redirects.
