# 2026-10-10 — Override of proxy-addr (Dependabot alert 127)

`proxy-addr` 2.0.7 (critical, IP spoofing via IPv4-mapped subnet) comes only from `shadcn > @modelcontextprotocol/sdk > express`. Dependabot cannot update it on its own: it is transitive and the direct package does not change version.
An `overrides` in `pnpm-workspace.yaml` brings `proxy-addr` to >=2.0.8. In the app it is not reached: `express` does not run in the runtime and no trust subnet is configured.
When `shadcn` updates its own dependencies the override can be removed. The other transitive advisories from `pnpm audit` are not touched, by choice.
