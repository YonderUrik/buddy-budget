# Staging reachable only from Tailscale (2026-10-25)

Daniele asked that `staging.buddybudget.io` resolve but answer only on the Tailscale network.
The staging host (PR #514) drops its public Cloudflare tunnel: the name is a public `A` record
(DNS only) pointing to the host's Tailscale address, and the nginx gateway publishes HTTPS only on
that address. The certificate comes from Let's Encrypt with the Cloudflare DNS-01 challenge
(`certs` service), needed because `buddybudget.io` sends HSTS with `includeSubDomains`.
A plain `A` record and not a `CNAME` to `.ts.net`, which Windows does not resolve reliably
(seen with `argo.buddybudget.io`). The edge password stays as a second lock. Steps and checks:
`docs/staging.md`.
