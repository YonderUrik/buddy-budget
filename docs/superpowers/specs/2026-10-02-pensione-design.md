# Pensione: design (2026-10-02)

Stato: implementata sul branch `claude/project-thread-43tais`, in attesa di decisione sulla produzione.

## Problema
Molti provider (es. Moneyfarm PIP) mostrano solo due serie: contributi netti e controvalore. Non c'è elenco dei versamenti.

## Modello
- `pension_funds` (nome, data di adesione) e `pension_snapshots` (data, contributi netti, controvalore; unica per fondo+data).
- I versamenti sono le differenze tra fotografie consecutive; prima della prima fotografia lo storico è distribuito a trimestri dall'adesione e segnato `estimated`.
- Calcoli puri in `lib/calc/pension.ts` (XIRR, tasse in uscita, forbice di prelievo, TFR in azienda, proiezione, ripartizione annuale).

## Schede
Panoramica, Andamento, Scenari (prelievo oggi, fondo vs TFR, tasse), Proiezione (3 scenari reali), I tuoi dati.

## Integrazioni
Patrimonio netto (classe `previdenza`, storico derivato, non salvato), barra laterale, export ZIP/JSON, reset account, metriche d'uso, catalogo/landing/login.

## Ipotesi aperte (da validare)
Base imponibile dell'imposta in uscita (per questo una forbice), regole del TFR in azienda, "contributi netti" al netto dei costi, inflazione fissa al 2%.

## Osservabilità
Eventi `pension.*` (Loki), eventi Umami `pension_*`, metriche d'uso nella dashboard "Utenti e utilizzo". Nessun cron/job/dipendenza esterna: nessun alert.
