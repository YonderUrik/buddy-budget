import BuddyBudgetKit
import Foundation

// fire-and-simulations.json → FireCalc / MonteCarlo / FirePlanning / CostsCalc.
extension VectorSuite {
    static let fireHandlers: [String: Handler] = [
        "fireNumber": { i in
            opt(FireCalc.fireNumber(annualSpending: try num(i["annualSpending"]), withdrawalRate: try num(i["withdrawalRate"])))
        },
        "fireNumberAfterTax": { i in
            opt(FireCalc.fireNumberAfterTax(grossNumber: try num(i["grossNumber"]), taxShare: try num(i["taxShare"])))
        },
        "wealthAfterYears": { i in .number(FireCalc.wealthAfterYears(try growthInput(i["input"]), years: try num(i["years"]))) },
        "yearsToTarget": { i in opt(FireCalc.yearsToTarget(try growthInput(i["input"]), target: try num(i["target"]))) },
        "coastNumber": { i in
            .number(FireCalc.coastNumber(target: try num(i["target"]), realReturn: try num(i["realReturn"]), years: try num(i["years"])))
        },
        "leanSpending": { i in .number(FireCalc.leanSpending(dovuta: try num(i["dovuta"]), saltuaria: try num(i["saltuaria"]))) },
        "sensitivityByRateAndReturn": { i in
            cells(FireCalc.sensitivityByRateAndReturn(
                annualSpending: try num(i["annualSpending"]), current: try num(i["current"]), annualSaving: try num(i["annualSaving"]),
                withdrawalRates: try nums(i["withdrawalRates"]), realReturns: try nums(i["realReturns"])
            ))
        },
        "sensitivityBySpendingAndSaving": { i in
            cells(FireCalc.sensitivityBySpendingAndSaving(
                annualSpending: try num(i["annualSpending"]), withdrawalRate: try num(i["withdrawalRate"]),
                realReturn: try num(i["realReturn"]), current: try num(i["current"]), annualSaving: try num(i["annualSaving"]),
                spendingChanges: try nums(i["spendingChanges"]), savingChanges: try nums(i["savingChanges"])
            ))
        },
        "savingsRate": { i in opt(FireCalc.savingsRate(income: try num(i["income"]), expenses: try num(i["expenses"]))) },
        "monthsOfCoverage": { i in
            opt(FireCalc.monthsOfCoverage(amount: try num(i["amount"]), monthlySpending: try num(i["monthlySpending"])))
        },
        "mulberry32": { i in
            var rand = MonteCarlo.mulberry32(try uint32(i["seed"]))
            return .array((0..<(try int(i["draws"]))).map { _ in .number(rand.next()) })
        },
        "pathSeed (private)": { i in
            let seed = try uint32(i["seed"])
            return .array(try nums(i["indices"]).map { .number(Double(MonteCarlo.pathSeed(seed, Int($0)))) })
        },
        "gaussian": { i in
            guard i["generator"].string == "mulberry32(pathSeed(1,0))" else { throw AdapterError("generator \(i["generator"])") }
            var rand = MonteCarlo.mulberry32(MonteCarlo.pathSeed(1, 0))
            return .array((0..<(try int(i["draws"]))).map { _ in .number(MonteCarlo.gaussian(&rand)) })
        },
        "lognormalParams": { i in
            let p = MonteCarlo.lognormalParams(expectedReturn: try num(i["expectedReturn"]), volatility: try num(i["volatility"]))
            return .object(["mu": .number(p.mu), "sd": .number(p.sd)])
        },
        "percentile": { i in
            let sorted = try nums(i["sorted"])
            if case .array(let ps) = i["p"] {
                return .array(try ps.map { .number(MonteCarlo.percentile(sorted, try num($0))) })
            }
            return .number(MonteCarlo.percentile(sorted, try num(i["p"])))
        },
        "runMonteCarlo": { i in try runMonteCarloVector(i) },
        "splitGrowth": { i in
            let points = try list(i["points"]).map {
                FireGrowthSplitPoint(month: try str($0["month"]), netWorth: try num($0["netWorth"]), savings: try num($0["savings"]))
            }
            let r = FireCalc.splitGrowth(points)
            return .object([
                "rows": .array(r.rows.map {
                    .object(["month": .string($0.month), "netWorth": .number($0.netWorth), "savings": .number($0.savings),
                             "delta": .number($0.delta), "fromSavings": .number($0.fromSavings), "fromMarket": .number($0.fromMarket)])
                }),
                "totalDelta": .number(r.totalDelta), "totalFromSavings": .number(r.totalFromSavings),
                "totalFromMarket": .number(r.totalFromMarket), "savingsShare": opt(r.savingsShare),
            ])
        },
        "computeLiquidation": { i in liquidation(FireCalc.computeLiquidation(try liquidationPositions(i["positions"]))) },
        "summarizeCosts": { i in try summarizeCostsVector(i) },
        "costDrag": { i in try costDragVector(i) },
        "resolvePlan": { i in
            let base = try planBase(i["base"])
            let a = try assumptions(i["assumptions"])
            let json = firePlanJSON(FirePlanning.resolvePlan(base, a))
            // resolvePlan-fewMonths pins only the figures that go missing.
            if i["base"].string == "monthsWithData=2" {
                return project(json, ["spending", "spendingSource", "savings", "target", "yearsToFire", "coast"])
            }
            return json
        },
        "resolvePlan(applyScenario)": { i in
            let a = FirePlanning.applyScenario(.defaults, try overrides(i["overrides"]))
            return project(firePlanJSON(FirePlanning.resolvePlan(defaultPlanBase, a)), ["savings", "savingsSource", "yearsToFire"])
        },
        "scenarioSlider": { i in
            guard let field = i["field"].string.flatMap(FireScenarioField.init(rawValue:)) else { throw AdapterError("field") }
            guard let s = FirePlanning.scenarioSlider(field, baseline: i["baseline"].double) else { return .null }
            return .object(["min": .number(s.min), "max": .number(s.max), "step": .number(s.step)])
        },
        "yearsToFireWith": { i in
            guard i["plan"].string == "resolvePlan-defaults" else { throw AdapterError("plan \(i["plan"])") }
            let p = FirePlanning.resolvePlan(defaultPlanBase, .defaults)
            return opt(FirePlanning.yearsToFireWith(p, .defaults, try overrides(i["overrides"])))
        },
        "buildSimulationInput": { i in
            guard i["plan"].string == "resolvePlan-defaults" else { throw AdapterError("plan \(i["plan"])") }
            let a = try assumptions(i["assumptions"])
            guard let retireAt = i["retireAt"].string.flatMap(FireRetireAt.init(rawValue:)) else { throw AdapterError("retireAt") }
            guard let s = FirePlanning.buildSimulationInput(FirePlanning.resolvePlan(defaultPlanBase, a), a, retireAt: retireAt)
            else { return .null }
            var o: [String: JSONValue] = [
                "startingWealth": .number(s.startingWealth), "annualSavings": .number(s.annualSavings),
                "accumulationYears": .number(s.accumulationYears), "retirementYears": .number(s.retirementYears),
                "annualSpending": .number(s.annualSpending), "expectedReturn": .number(s.expectedReturn),
                "volatility": .number(s.volatility), "rule": .string(s.rule.rawValue),
            ]
            if let inflation = s.inflation { o["inflation"] = .number(inflation) }
            if let p = s.publicPension {
                o["publicPension"] = .object(["annual": .number(p.annual), "startsAfterYears": .number(p.startsAfterYears)])
            }
            return .object(o)
        },
        "resolveExpectedReturn": { i in
            let a = try assumptions(i["assumptions"])
            let h = i["history"]
            let history: FireHistoricalReturnResult = h["status"].string == "ok"
                ? .ok(months: try int(h["months"]), shorterThanPeriod: h["shorterThanPeriod"] == .bool(true), fromKey: try str(h["fromKey"]),
                      toKey: try str(h["toKey"]), nominal: try num(h["nominal"]), real: h["real"].double)
                : .manca(reason: try str(h["reason"]))
            let r = FirePlanning.resolveExpectedReturn(a, history)
            return .object([
                "history": h, "historyReal": opt(r.historyReal), "clamped": .bool(r.clamped), "value": .number(r.value),
                "source": .string(r.source.rawValue), "high": .bool(r.high),
            ])
        },
    ]

    // MARK: Fire helpers

    static func opt(_ v: Double?) -> JSONValue { v.map(JSONValue.number) ?? .null }

    static func list(_ v: JSONValue) throws -> [JSONValue] {
        guard case .array(let a) = v else { throw AdapterError("expected array, got \(v)") }
        return a
    }

    static func nums(_ v: JSONValue) throws -> [Double] { try list(v).map { try num($0) } }

    /// JS `x >>> 0` for the seeds in the vectors.
    static func uint32(_ v: JSONValue) throws -> UInt32 {
        let d = try num(v)
        return UInt32(truncatingIfNeeded: Int64(d))
    }

    static func project(_ v: JSONValue, _ keys: [String]) -> JSONValue {
        guard case .object(let o) = v else { return v }
        return .object(o.filter { keys.contains($0.key) })
    }

    static func growthInput(_ v: JSONValue) throws -> FireGrowthInput {
        FireGrowthInput(current: try num(v["current"]), annualSaving: try num(v["annualSaving"]), realReturn: try num(v["realReturn"]))
    }

    static func cells(_ table: [[FireSensitivityCell]]) -> JSONValue {
        .array(table.map { row in
            .array(row.map { .object(["rowValue": .number($0.rowValue), "columnValue": .number($0.columnValue), "years": opt($0.years)]) })
        })
    }

    static func liquidationPositions(_ v: JSONValue) throws -> [FireLiquidationPosition] {
        try list(v).map {
            FireLiquidationPosition(id: try str($0["id"]), name: try str($0["name"]), value: try num($0["value"]),
                                    unrealizedGain: try num($0["unrealizedGain"]), taxRate: try num($0["taxRate"]))
        }
    }

    static func liquidation(_ r: FireLiquidationResult) -> JSONValue {
        .object([
            "latentTax": .number(r.latentTax), "grossValue": .number(r.grossValue), "netValue": .number(r.netValue),
            "taxRatio": opt(r.taxRatio),
            "byPosition": .array(r.byPosition.map { .object(["id": .string($0.id), "name": .string($0.name), "tax": .number($0.tax)]) }),
        ])
    }

    /// The base of `resolvePlan-defaults` (the other plan vectors refer to it by name).
    static let defaultPlanBase = FirePlanBase(
        wealth: .init(liquidity: 30000, investments: 120000, pension: 15000, debts: 0),
        cashflow: .init(annualSpending: 30000, annualSavings: 15000, monthsWithData: 12),
        positions: [
            FireLiquidationPosition(id: "a", name: "ETF World", value: 50000, unrealizedGain: 10000, taxRate: 0.26),
            FireLiquidationPosition(id: "b", name: "BTP", value: 20000, unrealizedGain: 2000, taxRate: 0.125),
            FireLiquidationPosition(id: "c", name: "Stock", value: 5000, unrealizedGain: -1500, taxRate: 0.26),
        ]
    )

    static func planBase(_ v: JSONValue) throws -> FirePlanBase {
        switch v.string {
        case "same as resolvePlan-defaults": return defaultPlanBase
        case "monthsWithData=2":
            var b = defaultPlanBase
            b.cashflow.monthsWithData = 2
            return b
        case .some(let s): throw AdapterError("base \(s)")
        case nil:
            return FirePlanBase(
                wealth: .init(liquidity: try num(v["wealth"]["liquidity"]), investments: try num(v["wealth"]["investments"]),
                              pension: try num(v["wealth"]["pension"]), debts: try num(v["wealth"]["debts"])),
                cashflow: .init(annualSpending: try num(v["cashflow"]["annualSpending"]),
                                annualSavings: try num(v["cashflow"]["annualSavings"]),
                                monthsWithData: try int(v["cashflow"]["monthsWithData"])),
                positions: try liquidationPositions(v["positions"])
            )
        }
    }

    /// `"DEFAULT…"` strings are DEFAULT_ASSUMPTIONS; an object overrides some of its fields.
    static func assumptions(_ v: JSONValue) throws -> FireAssumptions {
        if let s = v.string {
            guard s.hasPrefix("DEFAULT") else { throw AdapterError("assumptions \(s)") }
            return .defaults
        }
        guard case .object(let o) = v else { throw AdapterError("assumptions \(v)") }
        var a = FireAssumptions.defaults
        for (key, value) in o {
            switch key {
            case "withdrawalRate": a.withdrawalRate = try num(value)
            case "annualSpending": a.annualSpending = value.double
            case "annualSavings": a.annualSavings = value.double
            case "expectedReturn": a.expectedReturn = try num(value)
            case "expectedReturnAuto": a.expectedReturnAuto = value == .bool(true)
            case "volatility": a.volatility = try num(value)
            case "inflation": a.inflation = try num(value)
            case "retirementYears": a.retirementYears = try num(value)
            case "includePensionFunds": a.includePensionFunds = value == .bool(true)
            case "includeLatentTax": a.includeLatentTax = value == .bool(true)
            default: throw AdapterError("assumption field \(key)")
            }
        }
        return a
    }

    static func overrides(_ v: JSONValue) throws -> FireScenarioOverrides {
        FireScenarioOverrides(annualSavings: v["annualSavings"].double, annualSpending: v["annualSpending"].double,
                              expectedReturn: v["expectedReturn"].double, withdrawalRate: v["withdrawalRate"].double)
    }

    static func firePlanJSON(_ p: FirePlan) -> JSONValue {
        .object([
            "spending": opt(p.spending), "spendingSource": .string(p.spendingSource.rawValue),
            "savings": opt(p.savings), "savingsSource": .string(p.savingsSource.rawValue),
            "wealth": .number(p.wealth), "liquidation": liquidation(p.liquidation), "taxShare": .number(p.taxShare),
            "fireNumberGross": opt(p.fireNumberGross), "target": opt(p.target), "progress": opt(p.progress),
            "yearsToFire": opt(p.yearsToFire),
            "coast": .array(p.coast.map { .object(["years": .number($0.years), "number": .number($0.number)]) }),
        ])
    }

    static func wealthBand(_ b: MonteCarloWealthBand) -> JSONValue {
        .object(["year": .number(Double(b.year)), "p10": .number(b.p10), "p25": .number(b.p25), "p50": .number(b.p50),
                 "p75": .number(b.p75), "p90": .number(b.p90)])
    }

    static func spendingBand(_ b: MonteCarloSpendingBand) -> JSONValue {
        .object(["year": .number(Double(b.year)), "p10": .number(b.p10), "p50": .number(b.p50), "p90": .number(b.p90)])
    }

    /// Runs the simulation, then keeps the fields the generator pinned for that vector (gen-fire-vectors.ts).
    static func runMonteCarloVector(_ i: JSONValue) throws -> JSONValue {
        guard let rule = i["rule"].string.flatMap(WithdrawalRule.init(rawValue:)) else { throw AdapterError("rule") }
        let pension: MonteCarloPublicPension? = i["publicPension"].isNull ? nil
            : MonteCarloPublicPension(annual: try num(i["publicPension"]["annual"]), startsAfterYears: try num(i["publicPension"]["startsAfterYears"]))
        let pathsInput = i["paths"]
        let input = MonteCarloInput(
            startingWealth: try num(i["startingWealth"]), annualSavings: try num(i["annualSavings"]),
            accumulationYears: try num(i["accumulationYears"]), retirementYears: try num(i["retirementYears"]),
            annualSpending: try num(i["annualSpending"]), expectedReturn: try num(i["expectedReturn"]),
            volatility: try num(i["volatility"]), inflation: i["inflation"].double, rule: rule, publicPension: pension,
            paths: pathsInput.double, seed: i["seed"].isNull ? nil : try uint32(i["seed"])
        )
        let r = MonteCarlo.runMonteCarlo(input)
        let ending: JSONValue = .object(["p10": .number(r.endingWealth.p10), "p50": .number(r.endingWealth.p50), "p90": .number(r.endingWealth.p90)])
        let maxCut: JSONValue = .object(["median": .number(r.maxCut.median), "p90": .number(r.maxCut.p90)])
        let ruin: JSONValue = .array(r.ruinByYear.map(JSONValue.number))
        if pathsInput.string != nil { // "default(3000)"
            return .object(["paths": .number(Double(r.paths)), "successRate": .number(r.successRate), "endingWealth": ending])
        }
        if pathsInput.double == 0 { // clamps
            return .object(["paths": .number(Double(r.paths)), "wealthLen": .number(Double(r.wealth.count)),
                            "spendingLen": .number(Double(r.spending.count)), "successRate": .number(r.successRate)])
        }
        if pension != nil {
            return .object(["successRate": .number(r.successRate), "endingWealth": ending, "maxCut": maxCut,
                            "wealthYear10": wealthBand(r.wealth[10]), "wealthYear35": wealthBand(r.wealth[35]),
                            "spendingYear4": spendingBand(r.spending[4]), "spendingYear5": spendingBand(r.spending[5])])
        }
        if r.paths == 3 && rule == .guytonKlinger {
            return .object(["successRate": .number(r.successRate), "spending": .array(r.spending.prefix(5).map(spendingBand)),
                            "endingWealth": ending])
        }
        if r.paths == 3 {
            return .object(["rule": .string(r.rule.rawValue), "paths": .number(Double(r.paths)), "successRate": .number(r.successRate),
                            "wealth": .array(r.wealth.map(wealthBand)), "ruinByYear": ruin,
                            "spending": .array(r.spending.map(spendingBand)), "endingWealth": ending, "maxCut": maxCut])
        }
        return .object(["successRate": .number(r.successRate), "endingWealth": ending, "maxCut": maxCut,
                        "wealthYear0": wealthBand(r.wealth[0]), "wealthYear10": wealthBand(r.wealth[10]),
                        "wealthYear30": wealthBand(r.wealth[30]), "ruinByYear": ruin,
                        "spendingYear0": spendingBand(r.spending[0]), "spendingYear29": spendingBand(r.spending[29])])
    }

    static func summarizeCostsVector(_ i: JSONValue) throws -> JSONValue {
        let positions = try list(i["positions"]).map {
            CostPosition(id: try str($0["id"]), name: try str($0["name"]), value: try num($0["value"]), ter: $0["ter"].double,
                         subjectToBollo: $0["subjectToBollo"] == .bool(true))
        }
        let s = try CostsCalc.summarizeCosts(positions, productCountry: try str(i["productCountry"]))
        return .object([
            "rows": .array(s.rows.map {
                .object(["id": .string($0.id), "name": .string($0.name), "value": .number($0.value), "terCost": .number($0.terCost),
                         "bolloCost": .number($0.bolloCost), "total": .number($0.total), "pct": .number($0.pct)])
            }),
            "totalValue": .number(s.totalValue), "annualCost": .number(s.annualCost), "annualPct": opt(s.annualPct),
            "missingTerValue": .number(s.missingTerValue),
        ])
    }

    static func costDragVector(_ i: JSONValue) throws -> JSONValue {
        .array(CostsCalc.costDrag(value: try num(i["value"]), grossReturn: try num(i["grossReturn"]),
                                  annualCostPct: try num(i["annualCostPct"]), years: try int(i["years"])).map {
            .object(["year": .number(Double($0.year)), "withoutCosts": .number($0.withoutCosts), "withCosts": .number($0.withCosts),
                     "lost": .number($0.lost)])
        })
    }
}
