# 2026-10-10 — Override di proxy-addr (alert Dependabot 127)

`proxy-addr` 2.0.7 (critical, IP spoofing via subnet IPv4-mapped) arriva solo da `shadcn > @modelcontextprotocol/sdk > express`. Dependabot non può aggiornarlo da solo: è transitivo e il pacchetto diretto non cambia versione.
Si usa un `overrides` in `pnpm-workspace.yaml` che porta `proxy-addr` a >=2.0.8. Nell'app non è raggiunto: `express` non gira nel runtime e nessun trust subnet è configurato.
Quando `shadcn` aggiorna le proprie dipendenze l'override si può togliere. Gli altri advisory transitivi di `pnpm audit` non sono toccati, per scelta.
