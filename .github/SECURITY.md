# Security

## Reporting a vulnerability

If you find a vulnerability, **do not open a public issue**. Use the "Report a vulnerability" feature in the repository's *Security* tab (GitHub private reporting). Include the steps to reproduce it and, if you can, the impact you foresee.

The project is maintained by a single person: a response may take a few days. There is no bounty program.

## What must never go in the repository

Keys, tokens, credentials, real banking or personal data. If you find any by mistake in a file or in the history, report it the same way. Environment variables go in `.env.local` (ignored by git); [`.env.local.example`](../.env.local.example) contains only placeholders.
