# Costs and taxes in the Portfolio

Date: 2026-10-06

Independent toggles next to the chart and a separate card for recorded costs, recorded taxes, additional estimate and total, with a link to the Tasse (Taxes) tab.
`investmentTaxReport` is shared by Portfolio and `buildTaxView`: same data, tax rates, regime and offsetting of minusvalenze (capital losses); no second tax engine. The yearly residual of the estimate after recorded withholdings avoids double counting.
The simulation reinvests the excluded recorded charges from the day they were debited at the observed daily returns. The actual value is always the unchanged base: enabling «Reinvesti costi» ("Reinvest costs") or «Reinvesti imposte» ("Reinvest taxes") adds the corresponding revalued capital, including the shared tax estimates, without subtracting estimates from the real value. Under the regime amministrato (administered regime, the broker withholds tax) they are distributed over the sales according to the report; for the regime dichiarativo (declarative regime, the investor declares and pays)/crypto they are placed at year end (today for the open year), without representing the actual date of the tax payment.
The Portfolio loads all prices so as to keep the simulated value identical when changing period. Without an invested portfolio the savings stay as cash. Without a valuation the simulation is disabled; no change to saved balances.
Stand-alone broker charges and unrecorded TER excluded; bollo (stamp duty) separate in the Tasse tab and explicitly excluded here. Parity tests across views, losses, prior capital losses, custom tax rates, reinvestment and the four combinations of toggles.
