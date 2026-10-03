# Rilasci e versioni

Una sola versione semver per tutto il repo (app e landing), nel formato `0.MINOR.PATCH` finché si è in 0.x. La fonte di verità è `version` in `package.json` (la landing la tiene allineata); un test (`lib/release/release.test.ts`) fallisce se divergono o se manca la sezione nel `CHANGELOG.md`.

## Come si rilascia

1. `git checkout -b release/vX.Y.Z origin/main` e `pnpm release:prepare patch|minor|major` (oppure `X.Y.Z`; `--dry-run` per vedere solo l'anteprima). Alza la versione in `package.json` e `landing/package.json` e aggiunge in cima al `CHANGELOG.md` i titoli delle PR mergiate dall'ultimo tag.
2. Rivedi il changelog (togli il rumore, riscrivi le voci poco chiare), commit `Release vX.Y.Z`, apri la PR e mergiala.
3. Al merge la CI (`.github/workflows/ci.yml`, job `release`) vede una versione senza tag e: crea il tag `vX.Y.Z` e la GitHub Release con la sezione del changelog come note; costruisce le immagini con i tag `X.Y.Z`, `sha-xxxxxxx` e `main`; aggiorna il tag nel repo infra (app, migrate e landing), da cui ArgoCD fa il rollout. I due job di deploy usano gli environment `production` (app) e `landing`: lo storico è nella scheda *Deployments* del repo.

Quando alzare: `patch` per fix e ritocchi, `minor` per una funzione nuova o un cambiamento visibile, `major` solo dall'1.0 in poi. Si rilascia quando serve mettere in produzione, non a ogni PR.

## Cosa cambia rispetto a prima

- I merge su `main` che non cambiano la versione costruiscono comunque le immagini (`sha-…`, `main`) ma **non** le distribuiscono: il deploy avviene solo a ogni release. Per tornare al deploy a ogni merge basta togliere la condizione `is_release` dai due job di deploy.
- Rilanciare il workflow di una release andata a metà è sicuro: il job `release` riconosce un tag già presente sullo stesso commit.
- `main` richiede PR e check, quindi la CI non può spingere il bump: per questo la versione passa da una PR.

## Dove si vede la versione

- App: etichetta in fondo alla sidebar (`v0.2.0 · abc1234`, tooltip con data di build) e `GET /api/health`.
- Log: ogni riga JSON ha `version` e `commit`; a ogni avvio del pod c'è `app.process.started` (Loki: `{app="buddy-budget"} | json | event="app.process.started"`).
- Metriche: `buddybudget_build_info{version,commit}` (pannello "Versioni in esecuzione" della dashboard app).
- Immagini: `ghcr.io/yonderurik/buddy-budget:X.Y.Z` (e `-migrate`, `-landing`); nel repo infra il `newTag` di `kustomization.yaml` è la versione in produzione.

## Versione iniziale

`0.2.0` (2026-10-03): punto di partenza dichiarato, senza storia retroattiva. Prima l'app riportava sempre `0.1.0`.
