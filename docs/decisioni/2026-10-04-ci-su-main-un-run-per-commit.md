# CI on main: one run per commit and deploy after the checks

Date: 2026-10-04

With a single `concurrency` group on `main`, GitHub kept one run pending and discarded the intermediate ones: with two back-to-back merges the release PR's run might not start and the version was not deployed (the delay was observed too: the 21:23 run only started at 21:28, after the release run finished). Now every commit has its own group. To avoid lengthening the deploy, `release` no longer waits for the tests and the images are built in parallel with the tests (deploy from ~6.5 to ~4.5 minutes); the deploy is still conditional on the checks. On `main`, app lint and tests are skipped for landing/docs-only merges. The tag in infra never goes backwards and two back-to-back deploys are serialized (the last one wins). Accepted risk: the release PR and the tag can be created even if tests fail, but they are not deployed. Decision by Daniele ("si vai", 2026-10-04) on the CI report.
