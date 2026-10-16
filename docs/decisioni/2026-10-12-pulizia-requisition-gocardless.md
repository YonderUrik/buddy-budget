# Cleanup of GoCardless requisitions left without a row (2026-10-12)

A diagnosis in production showed 26 requisitions on GoCardless versus 5 known in the DB. Two gaps in the daily cleanup:
unknown requisitions were deleted only with `GOCARDLESS_CLEANUP_DELETE_UNKNOWN` (off) and after 30 days, and a
`pending` attempt that GoCardless already reported as `LN` (lost callback) stayed forever. Now an unknown requisition is
**ours** if its `reference` is one of our connections or its return URL is `<APP_URL>/api/gocardless/callback`:
ours that were never linked are deleted after 3 days (`stale_requisition`), those of other environments stay behind the flag;
unknown `LN` ones are never deleted on their own, they end up in the logs one by one (`gocardless.cleanup.linked_unknown`) and are
deleted only if approved by id in `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS`. The `LN` attempt without accounts follows the
orphans' grace period (7 days). Deleting does not free the month's slot (GoCardless counts it), but it keeps the list clean.
