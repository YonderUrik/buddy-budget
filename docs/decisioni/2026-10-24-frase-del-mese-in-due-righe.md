# Panoramica month sentence in two short lines (2026-10-24)

On the phone the sentence under the greeting («Ottobre è partito sopra il solito: 2662 € spesi, 880 € in più della tua media a questo punto. La rata Mutuo casa scade il 5 novembre: 365 €.») took four lines at 18 px and pushed net worth and its chart below the fold. Three options were tried on the real app with the demo data: two short lines, moving the comparison into «Il mese di» (header with greeting and date only), and a tappable chip. Daniele chose the two short lines.

- The header now shows one line per fact, at 15 px (16 px from `sm`): «Ottobre: 2662 € spesi, +880 € sul solito» and «Rata Mutuo casa: 365 € il 5 novembre» (`oggi`, `, scaduta`). The signed gap is red above the usual and green below; within 5% it says «come al solito»; without history only the amount spent.
- Same rules as before for when a line appears (no month line for a new user with nothing spent, instalments only within 14 days). Desktop gets the same lines.
- No new signal: a visual change with no new user action or outcome.
