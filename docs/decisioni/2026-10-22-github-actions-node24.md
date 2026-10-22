# GitHub Actions on Node 24

Data: 2026-10-22

Every action in the workflows moved to its first major that runs on Node 24 (checkout v7, setup-node v7, upload-artifact v7, pnpm/action-setup v6, the docker actions, release-please-action v5, fetch-metadata v3, action-semantic-pull-request v6, setup-kustomize v3 pinned by SHA), so the runner no longer forces them off Node 20 with a deprecation warning. None of the inputs we use was removed; checkout v7 only blocks checking out fork code in `pull_request_target`, which our workflows never do.
The "slow release" that prompted this was not slow: on the 0.85.2 run release-please took 13 seconds and the whole release, images and deploy included, 3.5 minutes. GitHub left that one job showing "in progress" after it had finished, so its timer kept counting.
Open: the image and deploy jobs only run on main, so the docker action bumps are first exercised by the merge of this PR and the next release.
