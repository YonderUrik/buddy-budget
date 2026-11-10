import Foundation

// MARK: - Errors (spec: api/README.md §5)

/// Stable machine codes of the backend (`API_ERROR_CODES`, plus better-auth's UPPER_CASE codes). Unknown codes are kept
/// in `.other` so an older app survives a new server value. Same cases as `ApiErrorCode` on Android.
public enum APIErrorCode: Equatable, Hashable, Sendable {
    case accountDeactivated
    case legalAcceptanceRequired
    case reauthRequired
    case countryFeatureUnavailable
    case unsupportedLocale
    case demoReadOnly
    case demoActive
    case validationFailed
    case notFound
    case tooManyRequests
    /// better-auth email OTP (api/auth.md §3.1).
    case invalidOTP
    case otpExpired
    case tooManyAttempts
    case other(String)

    public init(raw: String) {
        switch raw {
        case "account_deactivated": self = .accountDeactivated
        case "legal_acceptance_required": self = .legalAcceptanceRequired
        case "reauth_required": self = .reauthRequired
        case "country_feature_unavailable": self = .countryFeatureUnavailable
        case "unsupported_locale": self = .unsupportedLocale
        case "demo_read_only": self = .demoReadOnly
        case "demo_active": self = .demoActive
        case "validation_failed": self = .validationFailed
        case "not_found": self = .notFound
        case "too_many_requests": self = .tooManyRequests
        case "INVALID_OTP": self = .invalidOTP
        case "OTP_EXPIRED": self = .otpExpired
        case "TOO_MANY_ATTEMPTS": self = .tooManyAttempts
        default: self = .other(raw)
        }
    }
}

/// A non-2xx response other than 401, decoded from `{ error, code, field, version }` or better-auth's
/// `{ message, code }`. `message` is the server's human text (already translated when the catalog has it).
public struct APIErrorBody: Equatable, Sendable {
    public let status: Int
    public let code: APIErrorCode?
    public let message: String?
    public let field: String?
    /// `legal_acceptance_required` gate: the version to accept.
    public let version: String?
    /// `X-Retry-After` seconds on 429.
    public let retryAfter: Int?
    /// Raw body, for endpoints whose error responses carry a full result (`POST /api/investments/import`).
    public let data: Data

    public init(status: Int, code: APIErrorCode? = nil, message: String? = nil, field: String? = nil,
                version: String? = nil, retryAfter: Int? = nil, data: Data = Data()) {
        self.status = status
        self.code = code
        self.message = message
        self.field = field
        self.version = version
        self.retryAfter = retryAfter
        self.data = data
    }

    /// Parses the body of an error response; tolerant of empty or non-JSON bodies.
    public static func parse(status: Int, data: Data, retryAfter: String? = nil) -> APIErrorBody {
        struct Raw: Decodable {
            let error: String?
            let message: String?
            let code: String?
            let field: String?
            let version: String?
        }
        let raw = data.isEmpty ? nil : try? JSONDecoder().decode(Raw.self, from: data)
        return APIErrorBody(status: status, code: raw?.code.map(APIErrorCode.init(raw:)),
                            message: raw?.error ?? raw?.message, field: raw?.field, version: raw?.version,
                            retryAfter: retryAfter.flatMap { Int($0.trimmingCharacters(in: .whitespaces)) }, data: data)
    }

    /// True for the two proxy gates that require refetching `GET /api/me/bootstrap` (api/README.md §5 rule 3).
    public var isGate: Bool {
        status == 403 && (code == .accountDeactivated || code == .legalAcceptanceRequired)
    }
}

/// Errors surfaced to feature models. Mirrors `ApiError` in the Android app (spec: platform/architecture.md).
public enum APIError: Error, Equatable, Sendable {
    /// 401: no or expired session. The client has already signed out locally.
    case unauthorized
    case http(APIErrorBody)
    case decoding(String)
    /// Network failure (offline, timeout, DNS…).
    case transport(String)

    public var body: APIErrorBody? {
        if case .http(let body) = self { return body }
        return nil
    }

    public var code: APIErrorCode? { body?.code }
    public var status: Int? { body?.status }
    public var isTransport: Bool { if case .transport = self { return true } else { return false } }
}

// MARK: - Transport

/// Abstracts the network so tests can stub responses. `URLSession` conforms below.
public protocol HTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPTransport {}

/// Raw response for calls that need headers or bytes (sign-in token header, ZIP export).
public struct APIResponse: Sendable {
    public let status: Int
    public let headers: [String: String]
    public let data: Data

    /// Case-insensitive header lookup.
    public func header(_ name: String) -> String? {
        headers.first { $0.key.caseInsensitiveCompare(name) == .orderedSame }?.value
    }
}

/// Callbacks the app installs once (sign out on 401, re-route on a gate 403).
public final class APIEvents: @unchecked Sendable {
    private let lock = NSLock()
    private var unauthorized: (@Sendable () -> Void)?
    private var gate: (@Sendable (APIErrorBody) -> Void)?
    private var decodingFailure: (@Sendable (String) -> Void)?

    public init() {}

    /// SUP-024: called with the endpoint path when a response cannot be decoded (the native «screen failed to render»).
    public func set(onDecodingFailure: (@Sendable (String) -> Void)?) {
        lock.withLock { decodingFailure = onDecodingFailure }
    }

    public func set(onUnauthorized: (@Sendable () -> Void)?, onGate: (@Sendable (APIErrorBody) -> Void)?) {
        lock.withLock {
            unauthorized = onUnauthorized
            gate = onGate
        }
    }

    func fireUnauthorized() { lock.withLock { unauthorized }?() }
    func fireGate(_ body: APIErrorBody) { lock.withLock { gate }?(body) }
    func fireDecodingFailure(_ path: String) { lock.withLock { decodingFailure }?(path) }
}

// MARK: - Client

/// JSON client for the BuddyBudget backend (spec: api/auth.md §2, §7). Sends `Authorization: Bearer <token>` from the
/// `SessionStore` (verbatim), never cookies, a native User-Agent and the app language in `Accept-Language`.
/// A 401 clears the stored token and fires `events.onUnauthorized`; a gate 403 fires `events.onGate`.
public struct APIClient: Sendable {
    public let baseURL: URL
    public let session: SessionStore
    public let events: APIEvents
    private let transport: HTTPTransport
    private let userAgent: String
    private let acceptLanguage: @Sendable () -> String?

    public init(baseURL: URL, session: SessionStore = InMemorySessionStore(), transport: HTTPTransport = APIClient.makeSession(),
                userAgent: String = "BuddyBudget-iOS", events: APIEvents = APIEvents(),
                acceptLanguage: @escaping @Sendable () -> String? = { nil }) {
        self.baseURL = baseURL
        self.session = session
        self.transport = transport
        self.userAgent = userAgent
        self.events = events
        self.acceptLanguage = acceptLanguage
    }

    /// URLSession without cookie handling: a stray `Cookie` would trigger better-auth's origin check (auth.md §2).
    public static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.timeoutIntervalForRequest = 30
        // Long enough for the synchronous broker import (`POST /api/investments/import`, maxDuration 300 s).
        config.timeoutIntervalForResource = 330
        return URLSession(configuration: config)
    }

    // MARK: JSON helpers

    public func get<T: Decodable>(_ path: String, query: [String: String] = [:], as type: T.Type = T.self) async throws -> T {
        try decode(try await send(path, method: "GET", query: query), path: path)
    }

    public func post<T: Decodable>(_ path: String, body: some Encodable, as type: T.Type = T.self) async throws -> T {
        try decode(try await send(path, method: "POST", body: try encode(body)), path: path)
    }

    public func patch<T: Decodable>(_ path: String, body: some Encodable, as type: T.Type = T.self) async throws -> T {
        try decode(try await send(path, method: "PATCH", body: try encode(body)), path: path)
    }

    public func put<T: Decodable>(_ path: String, body: some Encodable, as type: T.Type = T.self) async throws -> T {
        try decode(try await send(path, method: "PUT", body: try encode(body)), path: path)
    }

    public func delete<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try decode(try await send(path, method: "DELETE"), path: path)
    }

    /// For 204 / empty-body endpoints.
    public func sendNoContent(_ path: String, method: String) async throws {
        _ = try await send(path, method: method)
    }

    /// For 204 / empty-body endpoints with a JSON body.
    public func sendNoContent(_ path: String, method: String, body: some Encodable) async throws {
        _ = try await send(path, method: method, body: try encode(body))
    }

    /// Lowest level: builds the request, maps 401/4xx/5xx and transport errors, returns status, headers and bytes.
    public func send(_ path: String, method: String, query: [String: String] = [:], body: Data? = nil,
                     accept: String = "application/json", contentType: String = "application/json",
                     timeout: TimeInterval? = nil) async throws -> APIResponse {
        var request = makeRequest(path, method: method, query: query, body: body, accept: accept)
        if body != nil { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        if let timeout { request.timeoutInterval = timeout }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await transport.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        var headers: [String: String] = [:]
        for (key, value) in http?.allHeaderFields ?? [:] {
            if let key = key as? String, let value = value as? String { headers[key] = value }
        }
        let result = APIResponse(status: status, headers: headers, data: data)
        if status == 401 {
            // Session expired or revoked: wipe the token and let the app go back to login (auth.md §3.5).
            if request.value(forHTTPHeaderField: "Authorization") != nil {
                session.clear()
                events.fireUnauthorized()
            }
            throw APIError.unauthorized
        }
        guard (200..<300).contains(status) else {
            let body = APIErrorBody.parse(status: status, data: data, retryAfter: result.header("X-Retry-After"))
            if body.isGate { events.fireGate(body) }
            throw APIError.http(body)
        }
        return result
    }

    func makeRequest(_ path: String, method: String, query: [String: String] = [:], body: Data? = nil,
                     accept: String = "application/json") -> URLRequest {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.httpShouldHandleCookies = false
        request.setValue(accept, forHTTPHeaderField: "Accept")
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        if let language = acceptLanguage() { request.setValue(language, forHTTPHeaderField: "Accept-Language") }
        if let token = session.readToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        return request
    }

    private func encode(_ value: some Encodable) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(value)
    }

    private func decode<T: Decodable>(_ response: APIResponse, path: String) throws -> T {
        if T.self == EmptyBody.self { return EmptyBody() as! T }
        do {
            return try JSONDecoder().decode(T.self, from: response.data)
        } catch {
            events.fireDecodingFailure(path)
            throw APIError.decoding(String(describing: error))
        }
    }
}

/// Placeholder for endpoints without a body (204, `200` empty).
public struct EmptyBody: Codable, Equatable, Sendable {
    public init() {}
}
