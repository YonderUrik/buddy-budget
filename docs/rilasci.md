# Rilasci e versioni

Una sola versione semver per tutto il repo (app e landing), nel formato `0.MINOR.PATCH` finché si è in 0.x. È calcolata in automatico da [release-please](https://github.com/googleapis/release-please) a partire dai **titoli delle PR**.

## Titoli delle PR (Conventional Commits)

Il merge è sempre uno squash e il titolo della PR diventa il messaggio del commit. La check `Titolo PR` (`.github/workflows/pr-title.yml`) controlla il formato `tipo(ambito opzionale): descrizione`, anche in italiano.

| Titolo | Effetto sulla versione |
|---|---|
| `feat: …` | minor (0.2.0 → 0.3.0) |
| `fix: …`, `perf: …` | patch (0.2.0 → 0.2.1) |
| `feat!: …` o `BREAKING CHANGE:` nel corpo | minor finché si è in 0.x, major dall'1.0 |
| `refactor:`, `docs:`, `chore:`, `ci:`, `test:`, `build:` | nessuna release (nel changelog compaiono `feat`, `fix`, `perf`, `refactor`) |

Dependabot usa già `chore(deps)`: non genera release.

## Come avviene il cambio versione

1. A ogni merge su `main`, il job `release` di `.github/workflows/ci.yml` esegue release-please, che legge i commit dall'ultimo tag e tiene aperta una PR `chore(main): release X.Y.Z` con la versione in `package.json` e `landing/package.json`, `.release-please-manifest.json` e il `CHANGELOG.md`. Se non ci sono `feat`/`fix` dall'ultimo tag, la PR non c'è.
2. Quando vuoi mettere in produzione, rivedi e **mergia la PR di release**. È l'unico gesto manuale.
3. Al merge release-please crea il tag `vX.Y.Z` e la GitHub Release con le note; nello stesso run la CI costruisce le immagini con i tag `X.Y.Z`, `sha-xxxxxxx` e `main` e aggiorna il tag nel repo infra (app, migrate, landing), da cui ArgoCD fa il rollout. I deploy compaiono nella scheda *Deployments* (environment `production` e `landing`).

I merge normali costruiscono le immagini (`sha-…`, `main`) ma **non** le distribuiscono: il deploy avviene solo alle release.

## Configurazione una tantum

- Repo → Settings → Actions → General → *Allow GitHub Actions to create and approve pull requests* (serve a release-please per aprire la PR).
- `main` richiede la check "Lint, tipi e test" e le PR create col `GITHUB_TOKEN` non fanno partire i workflow: per far girare i check sulla PR di release crea un token (PAT fine-grained con `contents` e `pull requests` in scrittura su questo repo) e salvalo come secret `RELEASE_PLEASE_TOKEN`. Senza, la PR di release si mergia con il bypass da admin. Lo stesso secret serve al workflow degli screenshot della landing (`bot/landing-screens`): con il solo `GITHUB_TOKEN` la sua PR non avvia CI e "Titolo PR" e va rilanciata a mano.

## Dove si vede la versione

- App: etichetta in fondo alla sidebar (`v0.2.0 · abc1234`, tooltip con data di build) e `GET /api/health`.
- Log: ogni riga JSON ha `version` e `commit`; a ogni avvio del pod c'è `app.process.started` (Loki: `{app="buddy-budget"} | json | event="app.process.started"`).
- Metriche: `buddybudget_build_info{version,commit}` (pannello "Versioni in esecuzione" della dashboard app).
- Immagini: `ghcr.io/yonderurik/buddy-budget:X.Y.Z` (e `-migrate`, `-landing`); nel repo infra il `newTag` di `kustomization.yaml` è la versione in produzione.

## Note

- Versione iniziale `0.2.0` (2026-10-03), senza storia retroattiva: `bootstrap-sha` in `release-please-config.json` fa partire il conteggio dei commit dal merge che l'ha introdotta.
- Se il run del merge di release fallisce a metà (immagini o infra), la Release esiste già e un rilancio non rifà il deploy: si rilancia a mano il job di deploy o si aggiorna il `newTag` in infra.
- Per forzare una versione: commit con `Release-As: X.Y.Z` nel corpo.

## Immagini e auto-merge

- Le immagini (app, migrator, landing) si costruiscono e pubblicano solo nel run del merge della PR di release, con tag `sha-…`, `main` e `X.Y.Z`. Un push normale su `main` esegue solo i test e tiene aggiornata la PR di release.
- `automerge.yml` abilita l auto-merge (squash) sulle PR di Dependabot patch e su `bot/landing-screens`. Serve "Allow auto-merge" nelle impostazioni del repo e le check obbligatorie sulla branch protection (`Lint, tipi e test`, `Titolo in formato Conventional Commits`): è la protezione a decidere quando unire. La PR di release e ogni minor/major restano a mano.

## Dipendenze: solo patch

`dependabot.yml` ignora gli aggiornamenti minor e major (restano quelli di sicurezza) e raggruppa le patch in una PR a settimana per cartella. Le PR hanno il prefisso `fix(deps)` (runtime) o `chore(deps-dev)` (sviluppo): le prime fanno partire una release con release-please, le seconde no. Le GitHub Actions si aggiornano a mano. Per fare di proposito un salto di minor o major si apre una PR normale, o si rimuove temporaneamente la regola `ignore`.

## Ordine dei job su `main` (dal 2026-10-04)

- Un run per commit su `main` (`concurrency` con lo SHA): i merge ravvicinati non si scartano più a vicenda, quindi il run di una release non può saltare.
- `release` (release-please) non aspetta i test. Le immagini partono subito dopo, in parallelo ai test; il **deploy** (tag nel repo infra) parte solo se le check sono passate (o saltate perché i file dell'app/landing non sono cambiati) e non è mai fallita né annullata una dipendenza.
- Su `main` il job "Cosa è cambiato" confronta con il commit precedente, come sulle PR: un merge di sola landing o documenti non rifà lint e test dell'app.
- I job di deploy hanno un gruppo `deploy-infra-*`: se due release arrivano ravvicinate, la più vecchia in attesa si scarta. Inoltre il tag in infra non torna mai a una versione più vecchia di quella già presente.
