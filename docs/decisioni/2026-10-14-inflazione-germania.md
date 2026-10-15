# Germany: first phase, inflation-adjusted returns

Enable one feature at a time, after localization, tests and a local trial. This phase concerns only inflation; taxation, pensions, income forecasts and FIRE remain blocked for DE.

## Implementation

- Financial registry per country, independent of language: Italy uses IT, Germany DE; both EUR only. Unsupported countries or currencies do not receive another country's index. The cron updates all registry areas and reports counts per area; the logs distinguish the area in the `reason` field.
- Eurostat replaced `prc_hicp_midx` (2015=100) with `prc_hicp_minr` (2025=100), ECOICOP v2 classification. Explicit requests: frequency M, unit I25, coicop18 TOTAL and national area. The provider checks the dimensions of the response.
- `source` identifies dataset, base and item. A change of series requires the full history from January 2000 and replaces the area in one transaction. No combination of different bases; no change to transactions. Errors or empty responses keep the previous data. Readers expose only the new compatible series: until the first successful update, the real value is unavailable, not computed from mixed data.
- Subsequent updates reload the last 36 months, keeping the history. The UI shows the country and the last available month, in Italian, English and German. Client cache separate per country.
- Formula unchanged: (1 + nominal return) / (1 + inflation) - 1. National HICP as a measure of the change in purchasing power; not a personal spending index nor a forecast.

## Sources verified on 14 October 2026

- https://ec.europa.eu/eurostat/web/hicp/information-data
- https://webgate.ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm
- https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=DE&coicop18=TOTAL&unit=I25&freq=M&sinceTimePeriod=2000-01

Real check: IT and DE returned 321 observations, January 2000–September 2026. Data loaded only into the isolated local database. No structural migration required.

## Verification in production after approval

Wait for the prices cron and check `inflationByArea` and `market.inflation.updated` for IT and DE; verify the real return with country Germany in English and German, then Italy in English and Italian. Missing data must produce an explicit message, with no fallback to Italy. German pension, taxes, income and Analitiche remain inaccessible. No merge/deploy included in the local trial.

## Next phases

2. Investment costs without Italian tax assumptions.
3. Basic investment taxation, versioned per year.
4. Specific taxation of funds and ETFs.
5. Income forecasts, first gross then net.
6. Recording of pension products and separation between capital and future income.
7. Product-specific pension projections.
8. Retirement/FIRE planning with the models already verified.
9. Crypto and special tax cases, each with its own scope of support.

Each phase: official sources, per-country logic, DE/EN translations, IT regressions, localhost trial, separate PR, approval and enabling.

## Local verification outcome

Production build and TypeScript successful. 55 targeted tests passed, including transactional rollback and invariance of the return under a change of base; 3 screenshot tests passed. Full suite: 2,217 tests passed and only the known logger error tied to `/Users/mario`; the two tests added later are included in the 55 targeted ones. Browser: four country/language combinations, national values verified in the APIs, real return present, explanation with the correct country, German blocks still active, no browser errors. Performance screenshots updated in both themes. Preview left in DE/en.
