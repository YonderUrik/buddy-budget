import Foundation

// Money in the API is a JSON number in the computed views and a numeric string in some row endpoints
// (api/README.md §6): these wrappers accept both. Same role as `FlexibleDoubleSerializer` on Android.

/// A required amount decoded from a JSON number or a numeric string.
@propertyWrapper
public struct FlexibleDouble: Decodable, Equatable, Hashable, Sendable {
    public var wrappedValue: Double

    public init(wrappedValue: Double) { self.wrappedValue = wrappedValue }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) {
            wrappedValue = number
        } else if let text = try? container.decode(String.self), let number = Double(text.trimmingCharacters(in: .whitespaces)) {
            wrappedValue = number
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected a number or a numeric string")
        }
    }
}

/// An optional amount (`null` or missing → nil) decoded from a JSON number or a numeric string.
@propertyWrapper
public struct FlexibleDoubleOrNil: Decodable, Equatable, Hashable, Sendable {
    public var wrappedValue: Double?

    public init(wrappedValue: Double?) { self.wrappedValue = wrappedValue }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            wrappedValue = nil
        } else {
            wrappedValue = try FlexibleDouble(from: decoder).wrappedValue
        }
    }
}

extension KeyedDecodingContainer {
    /// A missing key is `nil`, like an explicit `null`.
    public func decode(_ type: FlexibleDoubleOrNil.Type, forKey key: Key) throws -> FlexibleDoubleOrNil {
        try decodeIfPresent(type, forKey: key) ?? FlexibleDoubleOrNil(wrappedValue: nil)
    }
}

/// A string list that may be missing from an older server response: decodes as empty (kotlinx default `emptyList()`).
@propertyWrapper
public struct DefaultEmptyStrings: Decodable, Equatable, Hashable, Sendable {
    public var wrappedValue: [String]
    public init(wrappedValue: [String]) { self.wrappedValue = wrappedValue }
    public init(from decoder: Decoder) throws { wrappedValue = try decoder.singleValueContainer().decode([String].self) }
}

extension KeyedDecodingContainer {
    public func decode(_ type: DefaultEmptyStrings.Type, forKey key: Key) throws -> DefaultEmptyStrings {
        try decodeIfPresent(type, forKey: key) ?? DefaultEmptyStrings(wrappedValue: [])
    }
}
