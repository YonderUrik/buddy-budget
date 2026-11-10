import BuddyBudgetKit
import Foundation

/// Minimal JSON tree for the golden vectors.
public indirect enum JSONValue: Decodable, Sendable, Equatable, CustomStringConvertible {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    public subscript(key: String) -> JSONValue {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    public var string: String? { if case .string(let s) = self { return s }; return nil }
    public var double: Double? { if case .number(let n) = self { return n }; return nil }
    public var int: Int? { double.map { Int($0) } }
    public var isNull: Bool { self == .null }

    /// JS `String(value)` for interpolation values.
    public var jsString: String {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() && abs(n) < 1e21 ? String(Int64(n)) : String(n)
        case .bool(let b): return b ? "true" : "false"
        case .null: return ""
        default: return description
        }
    }

    public var description: String {
        switch self {
        case .null: return "null"
        case .bool(let b): return String(b)
        case .number(let n): return String(n)
        case .string(let s): return "\"" + s.unicodeScalars.map { $0.isASCII ? String($0) : String(format: "\\u{%04X}", $0.value) }.joined() + "\""
        case .array(let a): return "[" + a.map(\.description).joined(separator: ", ") + "]"
        case .object(let o): return "{" + o.keys.sorted().map { "\($0): \(o[$0]!.description)" }.joined(separator: ", ") + "}"
        }
    }
}

public struct Vector: Sendable, CustomStringConvertible {
    public let file: String
    public let id: String
    public let function: String
    public let input: JSONValue
    public let expected: JSONValue
    public let tolerance: Double?
    public var description: String { id }
}

public enum VectorOutcome: Sendable, Equatable {
    case pass
    case fail(String)
    case skip(String)
}

private struct VectorFile: Decodable {
    struct Raw: Decodable {
        let id: String
        let function: String
        let input: JSONValue
        let expected: JSONValue
        let tolerance: Double?
    }
    let vectors: [Raw]
}

/// Loads `spec/domain/vectors/*.json` and runs each vector through BuddyBudgetKit.
/// Every function name is either handled by a port or listed in `serverSide` (with the endpoint that replaces it);
/// an unknown function name fails, so new vectors are never skipped silently.
public enum VectorSuite {
    /// Every vector file of spec/domain/vectors. Each function is either ported (adapter) or listed in
    /// `serverSide` with the endpoint that replaces it.
    public static let files = [
        "formatting.json", "expenses.json", "cashflow.json", "liquidity.json", "net-worth.json", "debts.json",
        "goals.json", "pension.json", "italian-taxes.json", "fire-and-simulations.json", "returns.json",
        "category-colors.json", "costs.json", "exposure.json", "financial-planning-de.json", "fx.json",
        "investments.json", "month-pace.json", "overview-voice.json", "risk.json", "subscriptions.json",
    ]

    /// `<repo>/spec`, resolved from this file's location (override with `SPEC_DIR`).
    public static var specDirectory: URL {
        if let env = ProcessInfo.processInfo.environment["SPEC_DIR"] { return URL(fileURLWithPath: env) }
        return URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // BuddyBudgetVectors
            .deletingLastPathComponent() // Sources
            .deletingLastPathComponent() // BuddyBudgetKit
            .deletingLastPathComponent() // repo
            .appendingPathComponent("spec")
    }

    public static func load(_ file: String) throws -> [Vector] {
        let url = specDirectory.appendingPathComponent("domain/vectors").appendingPathComponent(file)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(VectorFile.self, from: data).vectors.map {
            Vector(file: file, id: $0.id, function: $0.function, input: $0.input, expected: $0.expected, tolerance: $0.tolerance)
        }
    }

    /// Vectors of `file`, or an empty list if it cannot be read (`load` reports the error).
    public static func vectors(_ file: String) -> [Vector] { (try? load(file)) ?? [] }

    /// nil when the bundled locale data equals `spec/domain/locale-data/locale-data.json`.
    public static func localeDataMismatch() -> String? {
        let url = specDirectory.appendingPathComponent("domain/locale-data/locale-data.json")
        guard let spec = try? Data(contentsOf: url) else { return "cannot read \(url.path)" }
        guard let bundled = BBFormat.bundledLocaleData() else { return "bundled locale-data.json missing" }
        return spec == bundled ? nil : "bundled locale-data.json differs from the spec copy: refresh it"
    }

    public static func run(_ v: Vector) -> VectorOutcome {
        guard files.contains(v.file) else { return .fail("no adapter for file \(v.file)") }
        let handlers = handlers[v.file] ?? [:]
        if let handler = handlers[v.function] {
            let actual: JSONValue
            do {
                actual = try handler(v.input)
            } catch let skip as SkipVector {
                return .skip(skip.reason)
            } catch {
                return .fail("threw \(error)")
            }
            return compare(actual, v.expected, tolerance: v.tolerance ?? 0) ? .pass
                : .fail("expected \(v.expected) got \(actual)")
        }
        if let reason = deferred[v.file]?[v.function] { return .skip(reason) }
        return .fail("unknown function \(v.function): add an adapter or defer it explicitly")
    }

    static func compare(_ a: JSONValue, _ b: JSONValue, tolerance: Double) -> Bool {
        switch (a, b) {
        case (.number(let x), .number(let y)):
            return x == y || abs(x - y) <= tolerance
        case (.array(let x), .array(let y)):
            return x.count == y.count && zip(x, y).allSatisfy { compare($0, $1, tolerance: tolerance) }
        case (.object(let x), .object(let y)):
            return Set(x.keys) == Set(y.keys) && x.keys.allSatisfy { compare(x[$0]!, y[$0]!, tolerance: tolerance) }
        default:
            return a == b
        }
    }
}
