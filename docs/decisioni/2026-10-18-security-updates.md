# Security updates, one library at a time

Data: 2026-10-18

`pnpm audit` reported 60 advisories in 16 packages (app and landing). 58 are fixed by moving each package to the patched release allowed by the range its parent already declares (lockfile only, one commit per package); `undici`, the only one the app uses at runtime (market-data fetch), goes to 7.30.1, which also carries eight later fixes. The minor bumps (browserslist, hono, qs, ip-address, MCP SDK, undici) were read against their release notes, and every bump was exercised through the tool that uses it (ESLint, shadcn CLI and its MCP server, drizzle-kit, the build, a live fetch with our TLS Agent).

Left as they are, on purpose:
- `esbuild` 0.18.20, pinned `~0.18.20` by `@esbuild-kit/core-utils` inside drizzle-kit 0.31 (still the latest stable). The advisory is about esbuild's dev server (`serve`), which drizzle-kit never starts; forcing 0.25 would jump seven pre-1.0 minors under a tool we cannot fully test. Revisit with drizzle-kit 1.0.
- `braces` 3.0.3: the patched 3.0.4 is not published on npm. It only expands glob patterns written by developers (fast-glob in the shadcn CLI and the landing's ESLint).
