import Foundation

// Broker-file import (07-investments §8, INV-092…105): ports of the web's `lib/investments/import/{providers,mapping,
// presets,normalize,fineco,statement-rows,messages,batch,format-metadata}.ts` and
// `components/domain/investments/import/investment-import.state.ts`. IBKR, DEGIRO and Trade Republic statements are
// parsed by the server (`POST /api/investments/import/parse`); generic, Yahoo and Fineco CSVs are read here with the
// same rules as the web (ADR 0002: no server parse endpoint exists for them yet, see api/gaps.md §5).
// Same names on Android (`BrokerImport.kt`). Italian strings are catalog sources.

// MARK: - Providers (`providers.ts`)

public enum ImportProviderId: String, Sendable, CaseIterable, Codable {
    case interactiveBrokers = "interactive-brokers"
    case degiro
    case yahooPortfolio = "yahoo-portfolio"
    case tradeRepublic = "trade-republic"
    case fineco
    case generic

    /// Parsed by the server (`/api/investments/import/parse`).
    public var isServerStatement: Bool { self == .interactiveBrokers || self == .degiro || self == .tradeRepublic }
}

/// `ImportProviderInfo`: one row of «Come ottengo il file?».
public struct ImportProviderInfo: Equatable, Sendable, Identifiable {
    public let id: ImportProviderId
    public let name: String
    public let initials: String
    public let tagline: String
    public let fileLabel: String?
    public let exportSteps: [String]
    public let note: String
}

public enum ImportProviders {
    /// `IMPORT_PROVIDERS`, in the web's order.
    public static let all: [ImportProviderInfo] = [
        ImportProviderInfo(
            id: .tradeRepublic, name: "Trade Republic", initials: "TR", tagline: "Investimenti e pagamenti con carta",
            fileLabel: "Transaction export.csv",
            exportSteps: [
                "Scarica da Trade Republic l'esportazione delle transazioni: il file si chiama «Transaction export.csv».",
                "Scegli lo storico completo del conto principale, non solo l'ultimo periodo.",
                "Caricalo qui sotto così com'è, senza aprirlo e risalvarlo con Excel.",
            ],
            note: "Importo investimenti, pagamenti con carta, bonifici, interessi e bonus. Il saldo è calcolato dai movimenti partendo da zero: il file non contiene un saldo certificato né il numero del conto. Usa questa fonte per un solo conto Trade Republic e aggiorna sempre con lo storico completo."),
        ImportProviderInfo(
            id: .degiro, name: "DEGIRO", initials: "DG", tagline: "Estratto conto Account.csv", fileLabel: "Account.csv",
            exportSteps: [
                "Accedi a DEGIRO dal sito, con la lingua impostata su italiano.",
                "Apri Attività → Estratto conto e scegli il periodo più ampio possibile.",
                "Premi Esporta, scegli CSV e carica qui il file «Account.csv».",
            ],
            note: "Include movimenti, commissioni e cambi. Il file non contiene una valutazione del portafoglio né il numero del conto: usa questa fonte per un solo conto DEGIRO."),
        ImportProviderInfo(
            id: .fineco, name: "Fineco", initials: "FB", tagline: "Movimenti Dossier Titoli (Excel)", fileLabel: "File Excel (.xlsx)",
            exportSteps: [
                "In FinecoX apri il dossier titoli e vai su Movimenti.",
                "Cerca il periodo che ti serve ed esporta in Excel (.xlsx).",
                "Carica qui il file Excel scaricato.",
            ],
            note: "Importo acquisti, vendite e, se presenti, dividendi e cedole. Il file non ha il saldo né le posizioni, quindi la liquidità non cambia. Uso «Data operazione», non la data valuta."),
        ImportProviderInfo(
            id: .interactiveBrokers, name: "Interactive Brokers", initials: "IB", tagline: "Activity Statement in CSV",
            fileLabel: "Activity Statement (.csv)",
            exportSteps: [
                "Nel portale apri Rendiconti → Rendiconti di attività (Activity Statement).",
                "Scegli Annuale o Personalizzato, con il periodo che ti serve.",
                "Come formato scegli CSV e come lingua inglese, poi carica il file qui.",
            ],
            note: "Puoi caricare più rendiconti insieme: li ordino per conto e periodo e salto quelli già importati."),
        ImportProviderInfo(
            id: .yahooPortfolio, name: "Yahoo Finance", initials: "YF", tagline: "Export del portafoglio", fileLabel: "File CSV",
            exportSteps: [
                "Su Yahoo Finance apri il tuo portafoglio.",
                "Premi Altro (⋯) → Esporta portafoglio.",
                "Carica qui il CSV scaricato.",
            ],
            note: "I simboli di Yahoo sono già quelli delle quotazioni, quindi gli strumenti si abbinano da soli. Controlla l'anteprima prima di confermare."),
    ]

    /// `getImportProvider` (`generic` has no card: its name is the generic CSV label).
    public static func info(_ id: ImportProviderId) -> ImportProviderInfo {
        all.first { $0.id == id } ?? ImportProviderInfo(id: .generic, name: "Altro CSV", initials: "CSV", tagline: "", fileLabel: nil,
                                                        exportSteps: [], note: "")
    }

    static let tradeRepublicHeaders = ["datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares",
                                       "price", "amount", "fee", "tax", "currency", "description", "transaction_id"]
    static let degiroHeaders = ["Data", "Ora", "Data Valore", "Prodotto", "ISIN", "Descrizione", "Borsa", "Variazioni", "", "Saldo", "",
                                "ID Ordine"]

    static func firstLineCells(_ text: String) -> [String] {
        let clean = text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
        let first = clean.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" || $0 == "\r\n" }).first.map(String.init) ?? ""
        let line = first.hasSuffix("\r") ? String(first.dropLast()) : first
        return ImportCsv.records(line, delimiter: ",").first ?? []
    }

    public static func looksLikeTradeRepublic(_ text: String) -> Bool {
        let headers = firstLineCells(text)
        return tradeRepublicHeaders.allSatisfy(headers.contains)
    }

    public static func looksLikeDegiro(_ text: String) -> Bool { firstLineCells(text) == degiroHeaders }

    /// An IBKR Activity Statement starts with the `Statement` section and names the broker.
    public static func looksLikeInteractiveBrokers(_ text: String) -> Bool {
        let clean = text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
        let head = String(clean.prefix(2000))
        return head.range(of: #"^"?Statement"?,"?Header"?,"#, options: .regularExpression) != nil
            && head.range(of: "Interactive Brokers", options: .caseInsensitive) != nil
    }

    /// `detectImportProvider`: known broker, Yahoo export, or nil (generic CSV).
    public static func detect(_ text: String) -> ImportProviderId? {
        if looksLikeTradeRepublic(text) { return .tradeRepublic }
        if looksLikeDegiro(text) { return .degiro }
        if FinecoImport.looksLikeFineco(text) { return .fineco }
        if looksLikeInteractiveBrokers(text) { return .interactiveBrokers }
        return ImportPresets.detect(ImportCsv.parse(text).headers)?.id == "yahoo-portfolio" ? .yahooPortfolio : nil
    }

    /// `providerMismatchMessage` (Italian text, already filled in: the web builds it the same way).
    public static func mismatchMessage(chosen: ImportProviderId, detected: ImportProviderId?) -> String? {
        if chosen == .generic || detected == chosen { return nil }
        let name = info(chosen).name
        let other = detected.map { " Sembra invece un file di \(info($0).name): scegli quella scheda." }
            ?? " Scegli un altro provider oppure «Altro CSV»."
        return "Questo file non sembra un export di \(name).\(other)"
    }
}

// MARK: - Mapping (`mapping.ts`)

/// `IMPORT_FIELDS`, in order.
public enum ImportField: String, CaseIterable, Sendable, Codable {
    case date, type, symbol, isin, name, quantity, price, total, fees, taxes, currency, note

    /// `IMPORT_FIELD_LABELS`.
    public var label: String {
        switch self {
        case .date: "Data operazione"
        case .type: "Tipo operazione"
        case .symbol: "Simbolo / ticker"
        case .isin: "ISIN"
        case .name: "Nome strumento"
        case .quantity: "Quantità"
        case .price: "Prezzo unitario"
        case .total: "Controvalore / importo"
        case .fees: "Commissioni"
        case .taxes: "Imposte"
        case .currency: "Valuta"
        case .note: "Note"
        }
    }

    /// Required fields come first in the mapping form.
    public static let required: Set<ImportField> = [.date, .symbol, .isin, .name, .quantity, .price, .total]
    /// Mapping form order (stable sort: required first).
    public static var formOrder: [ImportField] { allCases.filter { required.contains($0) } + allCases.filter { !required.contains($0) } }
}

/// Investment operation types (`INVESTMENT_TRANSACTION_TYPES`) with their labels (`TRANSACTION_TYPE_LABELS`).
public enum ImportOperationTypes {
    public static let all = ["acquisto", "vendita", "dividendo", "cedola", "rimborso", "split", "rettifica"]
    /// Targets offered for a value of the type column (no `rettifica`) + `ignora`.
    public static let typeTargets = ["acquisto", "vendita", "dividendo", "cedola", "rimborso", "split", "ignora"]
    public static func label(_ type: String) -> String {
        switch type {
        case "acquisto": "Acquisto"
        case "vendita": "Vendita"
        case "dividendo": "Dividendo"
        case "cedola": "Cedola"
        case "rimborso": "Rimborso"
        case "split": "Split"
        case "rettifica": "Operazione sul capitale"
        case "ignora": "Ignora la riga"
        default: type
        }
    }
}

/// `ImportMapping`.
public struct ImportMapping: Equatable, Sendable, Codable {
    public var columns: [ImportField: Int]
    public var dateOrder: ImportDateOrder
    public var decimal: ImportDecimalSeparator
    /// Key: cell value lower-cased → operation type or `ignora`.
    public var typeValues: [String: String]
    public var defaultType: String
    public var symbolIsYahoo: Bool

    public init(columns: [ImportField: Int], dateOrder: ImportDateOrder, decimal: ImportDecimalSeparator, typeValues: [String: String],
                defaultType: String = "acquisto", symbolIsYahoo: Bool = false) {
        self.columns = columns
        self.dateOrder = dateOrder
        self.decimal = decimal
        self.typeValues = typeValues
        self.defaultType = defaultType
        self.symbolIsYahoo = symbolIsYahoo
    }

    enum CodingKeys: String, CodingKey { case columns, dateOrder, decimal, typeValues, defaultType, symbolIsYahoo }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let raw = try c.decode([String: Int].self, forKey: .columns)
        columns = Dictionary(uniqueKeysWithValues: raw.compactMap { k, v in ImportField(rawValue: k).map { ($0, v) } })
        dateOrder = try c.decode(ImportDateOrder.self, forKey: .dateOrder)
        decimal = try c.decode(ImportDecimalSeparator.self, forKey: .decimal)
        typeValues = try c.decode([String: String].self, forKey: .typeValues)
        defaultType = try c.decode(String.self, forKey: .defaultType)
        symbolIsYahoo = try c.decode(Bool.self, forKey: .symbolIsYahoo)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(Dictionary(uniqueKeysWithValues: columns.map { ($0.key.rawValue, $0.value) }), forKey: .columns)
        try c.encode(dateOrder, forKey: .dateOrder)
        try c.encode(decimal, forKey: .decimal)
        try c.encode(typeValues, forKey: .typeValues)
        try c.encode(defaultType, forKey: .defaultType)
        try c.encode(symbolIsYahoo, forKey: .symbolIsYahoo)
    }
}

extension ImportDateOrder: Codable {}
extension ImportDecimalSeparator: Codable {}

public enum ImportMappingRules {
    static let headerSynonyms: [ImportField: [String]] = [
        .date: ["tradedate", "dataoperazione", "dataesecuzione", "dataeseguito", "operationdate", "transactiondate", "data", "date", "datetime"],
        .type: ["transactiontype", "tipooperazione", "tipo", "operazione", "segno", "side", "action", "type", "causale"],
        .symbol: ["symbol", "ticker", "simbolo", "codicetitolo", "codice"],
        .isin: ["isin", "codiceisin"],
        .name: ["name", "nome", "titolo", "descrizione", "strumento", "instrument", "security", "asset", "prodotto"],
        .quantity: ["quantity", "quantita", "qty", "quote", "shares", "units", "nominale"],
        .price: ["purchaseprice", "prezzoeseguito", "prezzounitario", "executionprice", "unitprice", "prezzo", "price"],
        .total: ["controvalore", "totale", "total", "importo", "amount", "ammontare", "value"],
        .fees: ["commission", "commissioni", "commissione", "fees", "fee", "spese", "costi"],
        .taxes: ["taxes", "imposte", "tasse", "tax"],
        .currency: ["currency", "valuta", "divisa"],
        .note: ["comment", "note", "nota", "notes"],
    ]

    static let typeSynonyms: [String: String] = [
        "buy": "acquisto", "acquisto": "acquisto", "acq": "acquisto", "a": "acquisto", "b": "acquisto", "purchase": "acquisto",
        "compra": "acquisto", "sottoscrizione": "acquisto", "sell": "vendita", "vendita": "vendita", "ven": "vendita", "v": "vendita",
        "s": "vendita", "sale": "vendita", "dividend": "dividendo", "dividendo": "dividendo", "div": "dividendo", "coupon": "cedola",
        "cedola": "cedola", "rimborso": "rimborso", "redemption": "rimborso", "maturity": "rimborso",
    ]

    /// `suggestTypeValue`.
    public static func suggestTypeValue(_ value: String) -> String {
        typeSynonyms[JSNumber.trim(value).lowercased()] ?? "ignora"
    }

    /// `suggestColumns`: exact synonyms first (in preference order), then headers starting with a long synonym.
    public static func suggestColumns(_ headers: [String]) -> [ImportField: Int] {
        let normalized = headers.map(ImportValues.normalizeHeader)
        var used = Set<Int>()
        var columns: [ImportField: Int] = [:]
        for exact in [true, false] {
            for field in ImportField.allCases where columns[field] == nil {
                for synonym in headerSynonyms[field] ?? [] {
                    let index = normalized.indices.first { i in
                        !used.contains(i) && (exact ? normalized[i] == synonym : synonym.count >= 5 && normalized[i].hasPrefix(synonym))
                    }
                    if let index {
                        columns[field] = index
                        used.insert(index)
                        break
                    }
                }
            }
        }
        return columns
    }

    /// `distinctValues`: non-empty values of a column, in order of appearance.
    public static func distinctValues(_ table: ImportCsvTable, column: Int?) -> [String] {
        guard let column else { return [] }
        var seen = Set<String>()
        var out: [String] = []
        for row in table.rows {
            let v = JSNumber.trim(column < row.count ? row[column] : "")
            if !v.isEmpty, seen.insert(v).inserted { out.append(v) }
        }
        return out
    }

    static func columnValues(_ table: ImportCsvTable, _ column: Int?) -> [String] {
        guard let column else { return [] }
        return table.rows.map { column < $0.count ? $0[column] : "" }.filter { !JSNumber.trim($0).isEmpty }
    }

    /// `completeMapping`: date/number formats from the values, type values by synonym; overrides win.
    public static func complete(_ table: ImportCsvTable, columns: [ImportField: Int], dateOrder: ImportDateOrder? = nil,
                                decimal: ImportDecimalSeparator? = nil, typeValues overrides: [String: String] = [:],
                                defaultType: String? = nil, symbolIsYahoo: Bool? = nil) -> ImportMapping {
        let numeric = [ImportField.quantity, .price, .total, .fees, .taxes].flatMap { columnValues(table, columns[$0]) }
        var typeValues: [String: String] = [:]
        for value in distinctValues(table, column: columns[.type]) { typeValues[value.lowercased()] = suggestTypeValue(value) }
        typeValues.merge(overrides) { _, new in new }
        return ImportMapping(
            columns: columns,
            dateOrder: dateOrder ?? ImportValues.detectDateOrder(columnValues(table, columns[.date])),
            decimal: decimal ?? ImportValues.detectDecimalSeparator(numeric, fallback: table.delimiter == ";" ? .comma : .dot),
            typeValues: typeValues, defaultType: defaultType ?? "acquisto", symbolIsYahoo: symbolIsYahoo ?? false)
    }

    /// `missingFields`: what the mapping still needs (Italian fragments, joined by the caller).
    public static func missingFields(_ mapping: ImportMapping) -> [String] {
        let c = mapping.columns
        var missing: [String] = []
        if c[.date] == nil { missing.append("la data") }
        if c[.symbol] == nil && c[.isin] == nil && c[.name] == nil { missing.append("lo strumento (simbolo, ISIN o nome)") }
        if c[.quantity] == nil { missing.append("la quantità") }
        if c[.price] == nil && c[.total] == nil { missing.append("il prezzo o il controvalore") }
        return missing
    }

    /// The mapping form changed the column of a field (`setColumn` in `import-mapping-fields.tsx`): a newly chosen type
    /// column gets its values translated by synonym, keeping choices already made.
    public static func settingColumn(_ mapping: ImportMapping, field: ImportField, column: Int?, table: ImportCsvTable) -> ImportMapping {
        var next = mapping
        next.columns[field] = column
        if field == .type {
            for v in distinctValues(table, column: next.columns[.type]) where next.typeValues[v.lowercased()] == nil {
                next.typeValues[v.lowercased()] = suggestTypeValue(v)
            }
        }
        return next
    }

    /// Option label of a column in the mapping selects: header (or `Colonna n`) and an example value.
    public static func columnExample(_ table: ImportCsvTable, column: Int) -> String {
        table.rows.first { column < $0.count && !JSNumber.trim($0[column]).isEmpty }.map { $0[column] } ?? ""
    }

    /// `mappingStorageKey`: device-local key of a mapping, from the normalized headers.
    public static func storageKey(_ headers: [String]) -> String {
        "bb-import-mapping:" + headers.map(ImportValues.normalizeHeader).joined(separator: "|")
    }

    /// `readSavedMapping` validity: every column exists in the file.
    public static func savedMappingIsValid(_ mapping: ImportMapping, headers: [String]) -> Bool {
        mapping.columns.values.allSatisfy { $0 >= 0 && $0 < headers.count }
    }
}

// MARK: - Presets (`presets.ts`)

public struct ImportPreset: Sendable {
    public let id: String
    public let label: String
    let requiredHeaders: [String]
    let adjust: @Sendable (ImportMapping) -> ImportMapping
}

public enum ImportPresets {
    public static let templateHeaders = ["Data", "Tipo", "ISIN", "Simbolo", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni",
                                         "Imposte", "Valuta", "Note"]

    public static let all: [ImportPreset] = [
        ImportPreset(id: "yahoo-portfolio", label: "Yahoo Finance · portafoglio",
                     requiredHeaders: ["symbol", "tradedate", "purchaseprice", "quantity"]) { mapping in
            var m = mapping
            m.dateOrder = .ymd
            m.decimal = .dot
            m.symbolIsYahoo = true
            m.typeValues = ["buy": "acquisto", "sell": "vendita"].merging(mapping.typeValues) { _, new in new }
            return m
        },
        ImportPreset(id: "buddybudget-template", label: "Modello BuddyBudget",
                     requiredHeaders: templateHeaders.map(ImportValues.normalizeHeader)) { mapping in
            var m = mapping
            m.dateOrder = .dmy
            m.decimal = .comma
            m.symbolIsYahoo = true
            return m
        },
    ]

    public static func detect(_ headers: [String]) -> ImportPreset? {
        let present = Set(headers.map(ImportValues.normalizeHeader))
        return all.first { $0.requiredHeaders.allSatisfy(present.contains) }
    }

    /// `initialMapping`: by synonyms, then adjusted by the recognised preset.
    public static func initialMapping(_ table: ImportCsvTable) -> (mapping: ImportMapping, preset: ImportPreset?) {
        let preset = detect(table.headers)
        let base = ImportMappingRules.complete(table, columns: ImportMappingRules.suggestColumns(table.headers))
        return (preset.map { $0.adjust(base) } ?? base, preset)
    }
}

// MARK: - Rows (`normalize.ts`)

/// `ImportIdentity`: how a row's instrument is identified; `key` groups the rows of one instrument.
public struct ImportIdentity: Equatable, Hashable, Sendable, Codable {
    public let key: String
    public var symbol: String?
    public var isin: String?
    public var name: String?
    public var currency: String?
    public let symbolIsYahoo: Bool
    public var type: String?

    public init(key: String, symbol: String?, isin: String?, name: String?, currency: String?, symbolIsYahoo: Bool, type: String? = nil) {
        self.key = key
        self.symbol = symbol
        self.isin = isin
        self.name = name
        self.currency = currency
        self.symbolIsYahoo = symbolIsYahoo
        self.type = type
    }
}

/// `ImportOperation` (API shape).
public struct ImportOperation: Equatable, Sendable, Codable {
    public let type: String
    public let date: String
    public let quantity: Double
    public let price: Double
    public let grossAmount: Double?
    public let fees: Double
    public let taxes: Double
    public let note: String?
    public var sourceCurrency: String?
    public var costCurrency: String?
    public var brokerFxToEur: Double?

    public init(type: String, date: String, quantity: Double, price: Double, grossAmount: Double?, fees: Double, taxes: Double,
                note: String?, sourceCurrency: String? = nil, costCurrency: String? = nil, brokerFxToEur: Double? = nil) {
        self.type = type
        self.date = date
        self.quantity = quantity
        self.price = price
        self.grossAmount = grossAmount
        self.fees = fees
        self.taxes = taxes
        self.note = note
        self.sourceCurrency = sourceCurrency
        self.costCurrency = costCurrency
        self.brokerFxToEur = brokerFxToEur
    }
}

/// `ImportRow`: a file line (1 = headers) read with the mapping.
public enum ImportRow: Equatable, Sendable {
    case ok(line: Int, identity: ImportIdentity, operation: ImportOperation, warnings: [String])
    case skipped(line: Int, message: String)
    case error(line: Int, message: String)

    public var line: Int {
        switch self {
        case .ok(let line, _, _, _), .skipped(let line, _), .error(let line, _): line
        }
    }

    public var isOk: Bool { if case .ok = self { return true } else { return false } }
    public var isError: Bool { if case .error = self { return true } else { return false } }

    public var message: String? {
        switch self {
        case .ok: nil
        case .skipped(_, let m), .error(_, let m): m
        }
    }

    public var operation: ImportOperation? { if case .ok(_, _, let op, _) = self { return op } else { return nil } }
    public var identity: ImportIdentity? { if case .ok(_, let id, _, _) = self { return id } else { return nil } }
    public var warnings: [String] { if case .ok(_, _, _, let w) = self { return w } else { return [] } }
}

/// An identity with the number of valid operations it has.
public struct ImportIdentityCount: Equatable, Sendable, Identifiable {
    public var identity: ImportIdentity
    public var count: Int
    public var id: String { identity.key }
}

public enum ImportNormalize {
    public static let noteMaxLength = 500
    static let positionTypes: Set<String> = ["acquisto", "vendita", "rimborso"]

    /// `isValidIsin` (format + Luhn check digit).
    public static func isValidIsin(_ value: String) -> Bool {
        guard value.range(of: #"^[A-Z]{2}[A-Z0-9]{9}\d$"#, options: .regularExpression) != nil else { return false }
        let chars = Array(value)
        var digits = ""
        for c in chars.prefix(11) {
            if c.isNumber { digits.append(c) } else { digits += String(Int(c.asciiValue!) - 55) }
        }
        var sum = 0
        var double = true
        for c in digits.reversed() {
            var d = Int(String(c))!
            if double {
                d *= 2
                if d > 9 { d -= 9 }
            }
            sum += d
            double.toggle()
        }
        return (10 - sum % 10) % 10 == Int(String(chars[11]))!
    }

    static func identityOf(_ cell: (ImportField) -> String, symbolIsYahoo: Bool) -> ImportIdentity? {
        let rawIsin = cell(.isin).uppercased()
        let isin = isValidIsin(rawIsin) ? rawIsin : nil
        let symbolText = cell(.symbol).uppercased()
        let symbol = symbolText.isEmpty ? nil : symbolText
        let nameText = cell(.name)
        let name = nameText.isEmpty ? nil : nameText
        let currencyText = cell(.currency)
        let currency = currencyText.range(of: "^[A-Za-z]{3}$", options: .regularExpression) != nil ? currencyText.uppercased() : nil
        let key = isin.map { "isin:\($0)" } ?? symbol.map { "symbol:\($0)" } ?? name.map { "name:\($0.lowercased())" }
        guard let key else { return nil }
        return ImportIdentity(key: key, symbol: symbol, isin: isin, name: name, currency: currency, symbolIsYahoo: symbolIsYahoo)
    }

    /// `normalizeRows`.
    public static func rows(_ table: ImportCsvTable, mapping: ImportMapping, today: String) -> [ImportRow] {
        table.rows.enumerated().map { index, cells -> ImportRow in
            let line = index + 2
            let cell: (ImportField) -> String = { field in
                guard let column = mapping.columns[field] else { return "" }
                return JSNumber.trim(column < cells.count ? cells[column] : "")
            }
            let number: (ImportField) -> Double? = { field in
                cell(field).isEmpty ? nil : ImportValues.parseNumber(cell(field), decimal: mapping.decimal)
            }
            let rawType = cell(.type)
            let target = rawType.isEmpty ? mapping.defaultType : (mapping.typeValues[rawType.lowercased()] ?? "ignora")
            if target == "ignora" { return .skipped(line: line, message: "Tipo \"\(rawType)\" ignorato") }

            guard let date = ImportValues.parseDate(cell(.date), order: mapping.dateOrder) else {
                return .error(line: line, message: cell(.date).isEmpty ? "Data mancante" : "Data \"\(cell(.date))\" non valida")
            }
            if date > today { return .error(line: line, message: "Data nel futuro") }
            guard let identity = identityOf(cell, symbolIsYahoo: mapping.symbolIsYahoo) else {
                return .error(line: line, message: "Manca lo strumento (simbolo, ISIN o nome)")
            }
            for field in [ImportField.quantity, .price, .total, .fees, .taxes] where !cell(field).isEmpty && number(field) == nil {
                return .error(line: line, message: "Numero \"\(cell(field))\" non valido")
            }
            var warnings: [String] = []
            if !cell(.isin).isEmpty && identity.isin == nil { warnings.append("ISIN \"\(cell(.isin))\" non valido, ignorato") }

            var type = target
            let signedQuantity = number(.quantity) ?? 0
            if type == "acquisto" && signedQuantity < 0 { type = "vendita" }
            let quantity = abs(signedQuantity)
            let total = number(.total).map(abs)
            let fees = abs(number(.fees) ?? 0)
            let taxes = abs(number(.taxes) ?? 0)
            let noteText = String(cell(.note).prefix(noteMaxLength))
            let note = noteText.isEmpty ? nil : noteText

            if type == "split" {
                guard quantity > 0 else { return .error(line: line, message: "Rapporto dello split mancante (va nella colonna delle quote)") }
                return .ok(line: line, identity: identity,
                           operation: ImportOperation(type: type, date: date, quantity: quantity, price: 0, grossAmount: nil, fees: 0, taxes: 0, note: note),
                           warnings: warnings)
            }
            if positionTypes.contains(type) {
                guard quantity > 0 else { return .error(line: line, message: "Quantità mancante o zero") }
                let price = number(.price).map(abs) ?? total.map { $0 / quantity }
                guard let price else { return .error(line: line, message: "Prezzo mancante") }
                if price == 0 && type != "acquisto" { return .error(line: line, message: "Prezzo zero su una vendita") }
                if price == 0 { warnings.append("Prezzo zero: quote ricevute gratis (es. staking)") }
                return .ok(line: line, identity: identity,
                           operation: ImportOperation(type: type, date: date, quantity: quantity, price: price, grossAmount: nil, fees: fees,
                                                      taxes: taxes, note: note),
                           warnings: warnings)
            }
            let price = abs(number(.price) ?? 0)
            let gross = total ?? (quantity > 0 && price > 0 ? quantity * price : nil)
            guard let gross, gross != 0 else { return .error(line: line, message: "Importo del dividendo o della cedola mancante") }
            return .ok(line: line, identity: identity,
                       operation: ImportOperation(type: type, date: date, quantity: 0, price: 0, grossAmount: gross, fees: fees, taxes: taxes, note: note),
                       warnings: warnings)
        }
    }

    /// `collectIdentities`: distinct instruments of the valid rows, with their operation count.
    public static func identities(_ rows: [ImportRow]) -> [ImportIdentityCount] {
        var order: [String] = []
        var byKey: [String: ImportIdentityCount] = [:]
        for row in rows {
            guard case .ok(_, let identity, _, _) = row else { continue }
            if var current = byKey[identity.key] {
                current.count += 1
                if current.identity.name == nil { current.identity.name = identity.name }
                if current.identity.symbol == nil { current.identity.symbol = identity.symbol }
                if current.identity.currency == nil { current.identity.currency = identity.currency }
                byKey[identity.key] = current
            } else {
                order.append(identity.key)
                byKey[identity.key] = ImportIdentityCount(identity: identity, count: 1)
            }
        }
        return order.compactMap { byKey[$0] }
    }

    /// Instrument shown for a preview row: symbol, else ISIN, else name.
    public static func instrumentLabel(_ identity: ImportIdentity) -> String { identity.symbol ?? identity.isin ?? identity.name ?? "" }

    /// `identityLabel`: «symbol · ISIN · name».
    public static func identityLabel(_ identity: ImportIdentity) -> String {
        [identity.symbol, identity.isin, identity.name].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

// MARK: - Fineco (`fineco.ts`)

public enum FinecoImport {
    static let headers = ["operazione", "datavaluta", "descrizione", "titolo", "isin", "segno", "quantita", "divisa", "prezzo", "controvalore"]
    public static let tableHeaders = ["Data", "Tipo", "ISIN", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni", "Valuta"]
    static let headerScanRows = 30

    static func recordsOf(_ text: String) -> [[String]] {
        let clean = text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
        let head = String(clean.prefix(4000))
        let delimiter: Character = head.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" || $0 == "\r\n" })
            .contains { $0.contains(";") } ? ";" : ","
        return ImportCsv.records(clean, delimiter: delimiter).map { $0.map { JSNumber.trim($0) } }
    }

    static func findHeaderRow(_ records: [[String]]) -> Int {
        for i in 0..<min(records.count, headerScanRows) {
            let present = Set(records[i].map(ImportValues.normalizeHeader))
            if headers.allSatisfy(present.contains) { return i }
        }
        return -1
    }

    public static func looksLikeFineco(_ text: String) -> Bool { findHeaderRow(recordsOf(String(text.prefix(20_000)))) >= 0 }

    static func plainNumber(_ value: String) -> String {
        let v = JSNumber.trim(value)
        if v.contains(",") {
            var out = v.replacingOccurrences(of: ".", with: "")
            if let comma = out.firstIndex(of: ",") { out.replaceSubrange(comma...comma, with: ".") }
            return out
        }
        return v
    }

    static func isoDate(_ value: String) -> String {
        guard let m = ImportXlsx.firstMatch(#"^(\d{1,2})/(\d{1,2})/(\d{4})$"#, in: value),
              let d = m[1], let mo = m[2], let y = m[3] else { return value }
        return "\(y)-\(String(repeating: "0", count: max(0, 2 - mo.count)))\(mo)-\(String(repeating: "0", count: max(0, 2 - d.count)))\(d)"
    }

    static func operationType(_ description: String, sign: String) -> String {
        let d = description.lowercased()
        if d.contains("compravendita") {
            return sign.uppercased() == "A" ? "Acquisto" : sign.uppercased() == "V" ? "Vendita" : description
        }
        if d.contains("dividend") { return "Dividendo" }
        if d.contains("cedol") { return "Cedola" }
        return description
    }

    /// `parseFinecoTable`; throws `ImportXlsxError` with the web's message when the table isn't found.
    public static func parseTable(_ text: String) throws -> ImportCsvTable {
        let records = recordsOf(text)
        let at = findHeaderRow(records)
        guard at >= 0 else {
            throw ImportXlsxError.message("Non trovo la tabella dei movimenti: serve l'export «Movimenti Dossier Titoli» di Fineco")
        }
        let rows = records.dropFirst(at + 1).filter { $0.contains { !$0.isEmpty } }.map { r -> [String] in
            let cell: (Int) -> String = { $0 < r.count ? r[$0] : "" }
            return [isoDate(cell(0)), operationType(cell(2), sign: cell(5)), cell(4).uppercased(), cell(3), plainNumber(cell(6)),
                    plainNumber(cell(8)), plainNumber(cell(10)), plainNumber(cell(11)), cell(7)]
        }
        return ImportCsvTable(delimiter: ";", headers: tableHeaders, rows: Array(rows))
    }

    /// `finecoMapping`.
    public static func mapping(_ table: ImportCsvTable) -> ImportMapping {
        ImportMappingRules.complete(table, columns: ImportMappingRules.suggestColumns(table.headers), dateOrder: .ymd, decimal: .dot,
                                    typeValues: ["acquisto": "acquisto", "vendita": "vendita", "dividendo": "dividendo", "cedola": "cedola"],
                                    symbolIsYahoo: false)
    }
}

// MARK: - Server statements (`statement-rows.ts`)

/// The subset of `ActivityStatement` (`POST /api/investments/import/parse`) the wizard uses. The original file text is
/// re-sent as `statementCsv`, so the statement itself is never sent back.
public struct ActivityStatement: Decodable, Equatable, Sendable {
    public struct Issue: Decodable, Equatable, Sendable {
        public let line: Int
        public let section: String
        public let severity: String
        public let message: String
    }

    public struct CashMovement: Decodable, Equatable, Sendable {
        public let line: Int
        public let date: String
        public let currency: String
        public let amount: Double
        public let externalId: String
        public let description: String
    }

    public struct Operation: Decodable, Equatable, Sendable {
        public let key: String
        public let line: Int
        public let type: String
        public let date: String
        public let quantity: Double
        public let price: Double
        public let grossAmount: Double?
        public let fees: Double
        public let taxes: Double
        public let note: String?
        public let sourceCurrency: String?
    }

    public struct Statement: Decodable, Equatable, Sendable {
        public let account: String
        public let from: String
        public let to: String
        public let issues: [String]
    }

    public let preset: String
    public let statement: Statement?
    public let cashMovements: [CashMovement]?
    public let identities: [ImportIdentity]
    public let operations: [Operation]
    public let issues: [Issue]

    public var provider: ImportProviderId { ImportProviderId(rawValue: preset) ?? .interactiveBrokers }

    /// The web's «nothing to import» test after a parse.
    public var isEmpty: Bool { operations.isEmpty && (cashMovements ?? []).isEmpty && !issues.contains { $0.severity == "error" } }

    /// `statementToRows`: valid operations as `ok` rows, error issues as `error` rows, by line.
    public var rows: [ImportRow] {
        let byKey = Dictionary(identities.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        var rows: [ImportRow] = []
        for op in operations {
            guard let identity = byKey[op.key] else { continue }
            rows.append(.ok(line: op.line, identity: identity,
                            operation: ImportOperation(type: op.type, date: op.date, quantity: op.quantity, price: op.price,
                                                       grossAmount: op.grossAmount, fees: op.fees, taxes: op.taxes, note: op.note,
                                                       sourceCurrency: op.sourceCurrency),
                            warnings: []))
        }
        for issue in issues where issue.severity == "error" {
            rows.append(.error(line: issue.line, message: "\(issue.section): \(issue.message)"))
        }
        return rows.enumerated().sorted { ($0.element.line, $0.offset) < ($1.element.line, $1.offset) }.map(\.element)
    }

    /// `statementWarnings`.
    public var warnings: [Issue] { issues.filter { $0.severity == "warning" } }
}

// MARK: - Messages (`messages.ts`)

/// `ExplainedMessage`: what is wrong (`text`) and what to do (`hint`). Italian; `text` may embed file values.
public struct ExplainedMessage: Equatable, Sendable {
    public let text: String
    public let hint: String?

    init(_ text: String, hint: String? = nil) {
        self.text = text
        self.hint = hint
    }
}

public enum ImportMessages {
    static let checkFile = "controlla quel valore nel file, oppure riesporta il file dal broker senza modificarlo."
    static let fieldLabels: [String: String] = [
        "amount": "importo", "price": "prezzo", "shares": "quantità", "fee": "commissione", "tax": "imposta", "fx_rate": "cambio",
        "datetime": "data e ora", "date": "data", "currency": "valuta", "isin": "ISIN", "transaction_id": "identificativo dell'operazione",
    ]

    static func match(_ pattern: String, _ text: String) -> [String?]? { ImportXlsx.firstMatch(pattern, in: text) }

    /// `explainRowMessage`.
    public static func explainRow(_ message: String) -> ExplainedMessage {
        if let m = match(#"^Tipo "(.*)" ignorato$"#, message), let v = m[1] {
            return ExplainedMessage("«\(v)» non è un acquisto, una vendita né un dividendo: la salto.")
        }
        if let m = match(#"^Data "(.*)" non valida$"#, message), let v = m[1] {
            return ExplainedMessage("La data «\(v)» non esiste.",
                                    hint: "correggila nel file (per esempio 31/02 non è un giorno valido) oppure togli la riga.")
        }
        switch message {
        case "Vende più quote di quelle possedute a quella data":
            return ExplainedMessage("Questa vendita supera le quote che avevi a quella data.",
                                    hint: "probabilmente mancano acquisti precedenti: importa prima lo storico completo (o aggiungi l'acquisto da «Registra») e riprova, oppure escludi lo strumento al passo Strumenti.")
        case "Data mancante": return ExplainedMessage("La riga non ha la data.", hint: "compila la data nel file oppure togli la riga.")
        case "Data nel futuro":
            return ExplainedMessage("La data è nel futuro.", hint: "controlla l'anno nel file: si importano solo operazioni già avvenute.")
        case "Manca lo strumento (simbolo, ISIN o nome)":
            return ExplainedMessage("La riga non dice di quale strumento si tratta.", hint: "compila almeno uno tra simbolo, ISIN e nome.")
        case "Quantità mancante o zero": return ExplainedMessage("La quantità manca o è zero.", hint: "compilala nel file oppure togli la riga.")
        case "Prezzo mancante": return ExplainedMessage("Il prezzo manca.", hint: "compilalo nel file oppure togli la riga.")
        case "Prezzo zero su una vendita":
            return ExplainedMessage("Una vendita ha prezzo zero.", hint: "controlla il prezzo nel file: solo gli acquisti possono essere gratuiti.")
        case "Importo del dividendo o della cedola mancante":
            return ExplainedMessage("Manca l'importo del dividendo o della cedola.", hint: "compila la colonna dell'importo oppure togli la riga.")
        case "Rapporto dello split mancante (va nella colonna delle quote)":
            return ExplainedMessage("Manca il rapporto dello split.",
                                    hint: "scrivilo nella colonna delle quantità (per esempio 2 per uno split 2 a 1).")
        default: break
        }
        if let m = match(#"^Numero "(.*)" non valido$"#, message), let v = m[1] {
            return ExplainedMessage("«\(v)» non è un numero.",
                                    hint: "se il numero è giusto, controlla il separatore dei decimali in «Come leggo le colonne»; altrimenti correggilo nel file.")
        }
        if let m = match(#"^(?:Riga (\d+): )?([a-z_]+) non valido$"#, message), let field = m[2], let label = fieldLabels[field] {
            if let line = m[1] {
                return ExplainedMessage("Alla riga \(line) il campo «\(label)» non contiene un valore valido.", hint: checkFile)
            }
            return ExplainedMessage("Il campo «\(label)» non contiene un valore valido.", hint: checkFile)
        }
        if let m = match(#"^(?:Riga (\d+): )?numero colonne non valido$"#, message) {
            let text = m[1].map { "La riga \($0) ha un numero di colonne diverso dalle altre." } ?? "Una riga ha un numero di colonne diverso dalle altre."
            return ExplainedMessage(text, hint: checkFile)
        }
        if let m = match(#"^Riga (\d+): (.*)$"#, message), let line = m[1], let rest = m[2] {
            var text = "Riga \(line): \(rest)."
            if text.hasSuffix("..") { text.removeLast() }
            return ExplainedMessage(text, hint: checkFile)
        }
        return ExplainedMessage(message)
    }

    /// `explainFileError`.
    public static func explainFile(_ message: String) -> ExplainedMessage {
        if message.hasPrefix("Questo file non sembra un export di ") {
            let text = ImportXlsx.replace(#" (Sembra invece|Scegli un altro).*$"#, in: message) { _ in "" }
            if let m = match(#"Sembra invece un file di (.+?):"#, message), let other = m[1] {
                return ExplainedMessage(text, hint: "Scegli la scheda \(other), oppure tocca di nuovo la scheda scelta per lasciar riconoscere il formato al file.")
            }
            return ExplainedMessage(text, hint: "Scegli il broker giusto, «Altro CSV» o lascia riconoscere il formato al file.")
        }
        if message == "Il file non sembra un CSV con intestazioni e almeno una riga" {
            return ExplainedMessage("Non riesco a leggere questo file.",
                                    hint: "serve un CSV o un Excel con una riga di intestazioni e almeno un'operazione. Non vanno bene PDF, immagini o file vuoti.")
        }
        if message == "Nel file Fineco non ci sono movimenti da importare" {
            return ExplainedMessage("Nel file di Fineco non ci sono movimenti.",
                                    hint: "riesporta i movimenti del dossier titoli con un periodo in cui ci sono operazioni.")
        }
        if message.hasPrefix("Nel rendiconto non ci sono acquisti") {
            return ExplainedMessage("Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare.",
                                    hint: "riesporta il rendiconto con un periodo più ampio.")
        }
        if message.hasPrefix("Seleziona al massimo") { return ExplainedMessage(message, hint: "importa i file in più volte.") }
        if message.hasPrefix("Ogni file deve essere più piccolo") { return ExplainedMessage(message, hint: "riesporta il file con un periodo più breve.") }
        if message.hasPrefix("La selezione supera") { return ExplainedMessage(message, hint: "importa i file in più volte.") }
        return explainRow(message)
    }
}

// MARK: - Batch (`batch.ts`)

public struct PreparedStatementFile: Equatable, Sendable {
    public let name: String
    public let text: String
    public let parsed: ActivityStatement

    public init(name: String, text: String, parsed: ActivityStatement) {
        self.name = name
        self.text = text
        self.parsed = parsed
    }
}

public enum ImportBatch {
    public static let maxFiles = 20
    public static let maxBytes = 25 * 1024 * 1024
    public static let maxFileBytes = 5 * 1024 * 1024
    /// `IMPORT_MAX_IDENTITIES` / `IMPORT_MAX_OPERATIONS` (INV-099, INV-105).
    public static let maxIdentities = 50
    public static let maxOperations = 5000

    /// `validateImportFiles`: the Italian error of a selection, nil when fine (INV-093).
    public static func validate(sizes: [Int]) -> String? {
        if sizes.count > maxFiles { return "Seleziona al massimo \(maxFiles) file alla volta." }
        if sizes.contains(where: { $0 > maxFileBytes }) { return "Ogni file deve essere più piccolo di 5 MB." }
        if sizes.reduce(0, +) > maxBytes { return "La selezione supera 25 MB. Seleziona meno file." }
        return nil
    }

    /// `orderStatementFiles`: IBKR before DEGIRO, then by account and period. Throws the first file's problem (Italian).
    public static func order(_ files: [PreparedStatementFile]) throws -> [PreparedStatementFile] {
        for file in files {
            if file.parsed.operations.isEmpty && (file.parsed.cashMovements ?? []).isEmpty {
                throw ImportXlsxError.message("\(file.name): nessuna operazione da importare. Carica un rendiconto con acquisti, vendite o proventi.")
            }
            guard let statement = file.parsed.statement else {
                throw ImportXlsxError.message("\(file.name): serve un rendiconto completo.")
            }
            let errors = statement.issues + file.parsed.issues.filter { $0.severity == "error" }.map(\.message)
            if let first = errors.first { throw ImportXlsxError.message("\(file.name): \(first)") }
        }
        return files.enumerated().sorted { a, b in
            let pa = a.element.parsed.preset == "degiro" ? 1 : 0
            let pb = b.element.parsed.preset == "degiro" ? 1 : 0
            if pa != pb { return pa < pb }
            let l = a.element.parsed.statement!, r = b.element.parsed.statement!
            if l.account != r.account { return l.account < r.account }
            if l.from != r.from { return l.from < r.from }
            if l.to != r.to { return l.to < r.to }
            return a.offset < b.offset
        }.map(\.element)
    }
}

// MARK: - Instrument choices (`investment-import.state.ts`)

/// `ImportMatch` from `POST /api/investments/import/resolve`.
public enum ImportMatch: Equatable, Sendable {
    case known(Instrument)
    case proposal(input: JSONNode, label: String, detail: String, type: String, confidence: String, source: String)
    case none(reason: String)
}

/// `InstrumentChoice`.
public enum InstrumentChoice: Equatable, Sendable {
    case known(Instrument)
    case create(input: JSONNode, label: String, detail: String, type: String, confidence: String, source: String)
    case skip(reason: String)

    /// `choiceFromMatch`.
    public init(_ match: ImportMatch) {
        switch match {
        case .known(let instrument): self = .known(instrument)
        case let .proposal(input, label, detail, type, confidence, source):
            self = .create(input: input, label: label, detail: detail, type: type, confidence: confidence, source: source)
        case .none(let reason): self = .skip(reason: reason)
        }
    }

    public var isUsable: Bool { if case .skip = self { return false } else { return true } }
}

/// `ChoiceTone` / `ChoiceStatus`.
public enum ChoiceTone: String, Sendable { case ready, check, missing, manual }

public struct ChoiceStatus: Equatable, Sendable {
    public let tone: ChoiceTone
    public let title: String
    public let text: String
}

public enum ImportChoices {
    /// `attentionRank`: not found first, then uncertain proposals, then the rest.
    public static func attentionRank(_ choice: InstrumentChoice?) -> Int {
        guard let choice else { return 0 }
        switch choice {
        case .skip: return 0
        case .create(_, _, _, _, let confidence, _): return confidence == "guess" ? 1 : 2
        case .known: return 2
        }
    }

    /// `describeChoice`.
    public static func describe(_ choice: InstrumentChoice?) -> ChoiceStatus {
        switch choice {
        case nil, .skip:
            if case .skip(let reason) = choice, reason == "unavailable" {
                return ChoiceStatus(tone: .missing, title: "Fonti non raggiungibili",
                                    text: "Non sono riuscito a cercarlo ora. Cercalo qui sotto oppure lascialo fuori dall'import.")
            }
            return ChoiceStatus(tone: .missing, title: "Non trovato",
                                text: "Non l'ho trovato né tra i tuoi strumenti né sulle fonti di prezzo. Cercalo qui sotto oppure lascialo fuori dall'import.")
        case .known(let instrument):
            let manual = instrument.priceMode == "manuale" && instrument.isin != nil
            return ChoiceStatus(tone: .ready, title: "Già tra i tuoi strumenti",
                                text: manual ? "Ha i prezzi manuali: durante l'import provo a collegare la quotazione automatica."
                                    : "Uso quello che hai già: le operazioni si aggiungono alla sua storia.")
        case .create(_, _, _, _, let confidence, let source):
            if source == "manuale" {
                return ChoiceStatus(tone: .manual, title: "Nuovo, con i prezzi del broker",
                                    text: "Non c'è una quotazione automatica compatibile (per esempio perché è in un'altra valuta): lo aggiungo con i prezzi del file e potrai collegarla dopo.")
            }
            if confidence == "guess" {
                return ChoiceStatus(tone: .check, title: "Da controllare",
                                    text: "Ho scelto la quotazione più probabile tra più risultati: verifica che sia quella giusta, o cambiala.")
            }
            return ChoiceStatus(tone: .ready, title: "Nuovo, collegato in automatico",
                                text: "Lo aggiungo ai tuoi strumenti con la quotazione trovata, e scarico i prezzi storici.")
        }
    }

    /// Instrument type label (`INSTRUMENT_TYPE_SINGULAR`).
    public static func typeLabel(_ type: String) -> String {
        switch type {
        case "etf": "ETF"
        case "azione": "Azione"
        case "obbligazione": "Obbligazione / BTP"
        case "fondo": "Fondo comune"
        case "crypto": "Crypto"
        case "etc": "ETC (materie prime)"
        default: type
        }
    }
}

/// One element of `instruments` in `POST /api/investments/import`.
public enum ImportInstrumentSelection: Equatable, Sendable {
    case existing(key: String, instrumentId: String)
    case create(key: String, input: JSONNode)

    public var key: String {
        switch self { case .existing(let k, _), .create(let k, _): k }
    }
}

/// `RunImportInput` (POST /api/investments/import).
public struct RunImportRequest: Equatable, Sendable {
    public var dryRun: Bool
    public var preset: String?
    public var instruments: [ImportInstrumentSelection]
    /// Operations with their instrument key and file line.
    public var operations: [(key: String, line: Int, operation: ImportOperation)]
    public var statementCsv: String?
    public var portfolioId: String?
    public var formatMetadata: JSONNode?

    public init(dryRun: Bool, preset: String?, instruments: [ImportInstrumentSelection], operations: [(key: String, line: Int, operation: ImportOperation)],
                statementCsv: String? = nil, portfolioId: String? = nil, formatMetadata: JSONNode? = nil) {
        self.dryRun = dryRun
        self.preset = preset
        self.instruments = instruments
        self.operations = operations
        self.statementCsv = statementCsv
        self.portfolioId = portfolioId
        self.formatMetadata = formatMetadata
    }

    public static func == (a: RunImportRequest, b: RunImportRequest) -> Bool {
        a.dryRun == b.dryRun && a.preset == b.preset && a.instruments == b.instruments && a.statementCsv == b.statementCsv
            && a.portfolioId == b.portfolioId && a.formatMetadata == b.formatMetadata
            && a.operations.map(\.key) == b.operations.map(\.key) && a.operations.map(\.line) == b.operations.map(\.line)
            && a.operations.map(\.operation) == b.operations.map(\.operation)
    }

    /// `buildImportRequest`: rows of included instruments only; nil when no operation is left.
    public static func build(rows: [ImportRow], choices: [String: InstrumentChoice], excluded: Set<String>, dryRun: Bool,
                             preset: String?) -> RunImportRequest? {
        var instruments: [ImportInstrumentSelection] = []
        for key in choices.keys.sorted() where !excluded.contains(key) {
            switch choices[key]! {
            case .known(let instrument): instruments.append(.existing(key: key, instrumentId: instrument.id))
            case .create(let input, _, _, _, _, _): instruments.append(.create(key: key, input: input))
            case .skip: break
            }
        }
        let included = Set(instruments.map(\.key))
        let operations = rows.compactMap { row -> (String, Int, ImportOperation)? in
            guard case .ok(let line, let identity, let operation, _) = row, included.contains(identity.key) else { return nil }
            return (identity.key, line, operation)
        }
        if operations.isEmpty { return nil }
        return RunImportRequest(dryRun: dryRun, preset: preset, instruments: instruments, operations: operations.map { ($0.0, $0.1, $0.2) })
    }

    /// JSON body (keys sorted, numbers as shortest decimals).
    public func json() -> JSONNode {
        var body: [String: JSONNode] = [
            "dryRun": .bool(dryRun),
            "preset": preset.map(JSONNode.string) ?? .null,
            "instruments": .array(instruments.map { selection in
                switch selection {
                case .existing(let key, let id): .object(["key": .string(key), "instrumentId": .string(id)])
                case .create(let key, let input): .object(["key": .string(key), "create": input])
                }
            }),
            "operations": .array(operations.map { op in
                var o: [String: JSONNode] = [
                    "key": .string(op.key), "line": .number(Double(op.line)), "type": .string(op.operation.type),
                    "date": .string(op.operation.date), "quantity": .number(op.operation.quantity), "price": .number(op.operation.price),
                    "grossAmount": op.operation.grossAmount.map(JSONNode.number) ?? .null, "fees": .number(op.operation.fees),
                    "taxes": .number(op.operation.taxes), "note": op.operation.note.map(JSONNode.string) ?? .null,
                ]
                if let currency = op.operation.sourceCurrency { o["sourceCurrency"] = .string(currency) }
                return .object(o)
            }),
        ]
        if let statementCsv { body["statementCsv"] = .string(statementCsv) }
        if let portfolioId { body["portfolioId"] = .string(portfolioId) }
        if let formatMetadata { body["formatMetadata"] = formatMetadata }
        return .object(body)
    }
}

/// `mappedFormatMetadata`: anonymized column profile of a generic CSV import.
public enum ImportFormatMetadata {
    public static func mapped(_ table: ImportCsvTable, mapping: ImportMapping, provider: ImportProviderId?) -> JSONNode {
        let institution: JSONNode = if let provider, provider != .generic {
            .object(["name": .string(ImportProviders.info(provider).name), "evidence": .string("recognized_format")])
        } else {
            .object(["name": .null, "evidence": .string("unknown")])
        }
        let delimiter: String = switch table.delimiter {
        case ",": ","
        case ";": ";"
        case "\t": "\t"
        case "|": "|"
        default: "unknown"
        }
        let columns: [JSONNode] = table.headers.enumerated().map { index, name in
            let trimmed = JSNumber.trim(name)
            let maps = ImportField.allCases.filter { mapping.columns[$0] == index }.map { JSONNode.string($0 == .total ? "grossAmount" : $0.rawValue) }
            return .object(["section": .null, "index": .number(Double(index)), "name": trimmed.isEmpty ? .null : .string(trimmed),
                            "mapsTo": .array(maps)])
        }
        return .object(["version": .number(1), "institution": institution, "delimiter": .string(delimiter), "columns": .array(columns)])
    }
}
