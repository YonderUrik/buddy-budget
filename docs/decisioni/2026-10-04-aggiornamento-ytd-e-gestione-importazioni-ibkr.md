# YTD updates and IBKR import management

Date: 2026-10-04

At the user's request, new CSVs replace fully covered periods within a single transaction; explicit preview and reconciliation of the following periods. Partial overlaps require a complete export so as not to invent intermediate snapshots. From Rendiconti (Statements) imports can be managed and deleted: removing a period requires confirming the list of dependent later periods, checked under lock. Balance restored to the last retained close; catalog/prices kept. No push or PR.
