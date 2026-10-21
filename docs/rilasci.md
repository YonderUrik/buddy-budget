# Releases and versions

A single semver version for the whole repo (app and landing), in the format `0.MINOR.PATCH` while in 0.x. It is calculated automatically by [release-please](https://github.com/googleapis/release-please) from the **PR titles**.

## PR titles (Conventional Commits)

Merges are always squashed and the PR title becomes the commit message. The `Titolo PR` check (`.github/workflows/pr-title.yml`) verifies the format `type(optional scope): description`, Italian allowed.

| Title | Effect on the version |
|---|---|
| `feat: …` | minor (0.2.0 → 0.3.0) |
| `fix: …`, `perf: …` | patch (0.2.0 → 0.2.1) |
| `feat!: …` or `BREAKING CHANGE:` in the body | minor while in 0.x, major from 1.0 |
| `refactor:`, `docs:`, `chore:`, `ci:`, `test:`, `build:` | no release (`feat`, `fix`, `perf`, `refactor` appear in the changelog) |

Dependabot already uses `chore(deps)`: it does not trigger a release.

## How the version changes

1. On every merge to `main`, the `release` job of `.github/workflows/ci.yml` runs release-please, which reads the commits since the last tag and keeps open a `chore(main): release X.Y.Z` PR with the version in `package.json` and `landing/package.json`, `.release-please-manifest.json` and the `CHANGELOG.md`. If there are no `feat`/`fix` since the last tag, there is no PR.
2. When you want to ship to production, review and **merge the release PR**. It is the only manual step.
3. On merge, release-please creates the `vX.Y.Z` tag and the GitHub Release with the notes; in the same run the CI builds the images with the tags `X.Y.Z`, `sha-xxxxxxx` and `main` and updates the tag in the infra repo (app, migrate, landing), from which ArgoCD does the rollout. Deploys appear in the *Deployments* tab (environments `production` and `landing`).

Normal merges build the images (`sha-…`, `main`) but do **not** deploy them: deployment happens only on releases.

## One-time configuration

- Repo → Settings → Actions → General → *Allow GitHub Actions to create and approve pull requests* (needed by release-please to open the PR).
- `main` requires the "Lint, tipi e test" check, and PRs created with `GITHUB_TOKEN` do not trigger workflows: to run the checks on the release PR, create a token (fine-grained PAT with write access to `contents` and `pull requests` on this repo) and save it as the `RELEASE_PLEASE_TOKEN` secret. Without it, the release PR is merged with the admin bypass. The same secret is used by the landing screenshot workflow (`bot/landing-screens`): with only `GITHUB_TOKEN` its PR does not trigger CI and "Titolo PR", which must be rerun manually.

## Where the version is shown

- App: label at the bottom of the sidebar (`v0.2.0 · abc1234`, tooltip with the build date) and `GET /api/health`.
- Logs: every JSON line has `version` and `commit`; on each pod start there is `app.process.started` (Loki: `{app="buddy-budget"} | json | event="app.process.started"`).
- Metrics: `buddybudget_build_info{version,commit}` ("Versioni in esecuzione" ("Running versions") panel of the app dashboard).
- Images: `ghcr.io/yonderurik/buddy-budget:X.Y.Z` (and `-migrate`, `-landing`); in the infra repo the `newTag` of `kustomization.yaml` is the version in production.

## Notes

- Initial version `0.2.0` (2026-10-03), without retroactive history: `bootstrap-sha` in `release-please-config.json` starts counting commits from the merge that introduced it.
- If the release merge run fails halfway (images or infra), the Release already exists and a rerun does not redo the deploy: rerun the deploy job manually or update the `newTag` in infra.
- To force a version: a commit with `Release-As: X.Y.Z` in the body.

## Images and auto-merge

- The images (app, migrator, landing) are built and published only in the run of the release PR merge, with tags `sha-…`, `main` and `X.Y.Z`. A normal push to `main` only runs the tests and keeps the release PR up to date.
- `automerge.yml` enables auto-merge (squash) on Dependabot patch PRs (landing screenshots no longer go through PRs: see `docs/landing-screens.md`). It requires "Allow auto-merge" in the repo settings and the required checks in branch protection (`Lint, tipi e test`, `Titolo in formato Conventional Commits`): the protection decides when to merge. The release PR and every minor/major remain manual.

## Dependencies: patch only

`dependabot.yml` ignores minor and major updates (security ones remain) and groups patches into one PR per week per folder. PRs have the prefix `fix(deps)` (runtime) or `chore(deps-dev)` (development): the former trigger a release with release-please, the latter do not. GitHub Actions are updated manually. To deliberately jump a minor or major, open a normal PR, or temporarily remove the `ignore` rule.

## Job order on `main` (since 2026-10-04)

- One run per commit on `main` (`concurrency` keyed on the SHA): merges close together no longer cancel each other, so a release run cannot be skipped.
- `release` (release-please) does not wait for the tests. The images start right after, in parallel with the tests; the **deploy** (tag in the infra repo) starts only if the checks passed (or were skipped because the app/landing files did not change) and no dependency failed or was cancelled.
- On `main` the "Cosa è cambiato" ("What changed") job compares with the previous commit, as on PRs: a merge touching only the landing or docs does not rerun the app's lint and tests.
- The deploy jobs have a `deploy-infra-*` group: if two releases arrive close together, the older pending one is discarded. Moreover, the tag in infra never goes back to a version older than the one already present.
