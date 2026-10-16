# Price source fixtures

Responses from the sources used by the parser tests. Those with the `synthetic-` prefix are hand-written following the
documented format, because the sources cannot be reached from the cloud sandbox. The `scripts/probe-price-sources.ts` script
(Task 1 of the investments plan) saves the real responses with the `real-` prefix: when they exist, the tests use them
instead of the synthetic ones to verify that the real format has not changed.
