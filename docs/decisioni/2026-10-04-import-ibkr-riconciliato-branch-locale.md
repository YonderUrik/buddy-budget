# Reconciled IBKR import (local branch)

Date: 2026-10-04

The original CSV is re-read on the server and saved in full with the statement. The import requires continuity of periods and a match of cash/quantities; concurrent re-imports are idempotent. Fully disposed spin-offs transfer shares and cost basis without inventing a purchase. The values reported by IBKR can be viewed separately from the average-cost calculations. Manual instruments isolated per user/ISIN/currency. No push or PR at the user's request; specification and limits in [ibkr-import.md](ibkr-import.md).
