# Germany: investment costs

Second phase of the rollout after inflation. The German Investimenti view already showed recorded fees and taxes without Italian tax estimates; no new page or enabling of Analitiche/FIRE is needed in this phase.

## Changes

The shared annual-cost calculator now explicitly requires the country. The financial registry keeps the existing Italian bollo (stamp duty) for IT (0.2%) and does not apply this levy for DE. An unknown or omitted country does not implicitly fall back to Italy. The TER stays separate from national levies; saved amounts, names and transactions remain unchanged. The three Analitiche views pass the country explicitly, but remain inaccessible for DE until the FIRE phase.

In the portfolio the panel explains that the fund's costs are already reflected in the price, are not subtracted again and are not recorded fees. Any unrecorded broker costs are not included. For DE only recorded costs and taxes are shown, without Italian stamp duty and without German tax estimates. This does not assert that the account is exempt from taxes or broker fees.

Fixed a defect in the «Rimetti i costi» ("Put the costs back") simulation: the text showed `{0}` instead of the amount paid. Now the two amounts are formatted with cents in the current language; the simulation's accessible state is translated. The hypothetical effects remain distinct from the amounts paid and do not change the operations.

## Sources verified on 14 October 2026

- BaFin, costs covered by the fund's assets and possible custody fees: https://bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/geldanlage/wertpapiere/offene-immobilienfonds/offene-immobilienfonds.html
- iShares, TER and daily deduction of fees from the fund: https://www.ishares.com/de/professionelle-anleger/de/wissen-service/etf-faq

No German tax rates were introduced. Basic taxation remains the next phase, with verification of the rules per year.

## Verification in production after approval

With country Germany and English/German language, open Investimenti and «Costi e imposte» ("Costs and taxes"): amounts equal to the recorded costs, no placeholder, no additional tax estimate. Turn on the two toggles separately and together; return to the original state and check that the operations do not change. With Italy, check the continuity of the tax view and the annual costs. The pension and Analitiche blocks for DE must remain active.

Observability: no new service, job or persisted data; the CI checks, the errors of the existing APIs and the browser check of the local calculation remain. No migration or deploy required for the localhost test.

## Local outcome

Production build, TypeScript, lint of the modified files and feature catalog successful. 54 targeted tests passed. Full suite: 2,223 passed, only known error in the logger due to the local directory name `/Users/mario`. Browser verified on DE/en, DE/de, IT/it and IT/en: amounts paid compared with the APIs, no `{0}`, both toggles and return to the initial state, transactions unchanged, German blocks confirmed. No browser errors. Portfolio screenshots updated in both themes; 3 screenshot tests passed; preview left in DE/en. No merge/deploy.
