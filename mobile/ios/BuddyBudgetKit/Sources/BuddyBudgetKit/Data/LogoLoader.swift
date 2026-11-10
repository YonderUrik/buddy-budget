import Foundation

/// Loads merchant/bank/instrument logos (`/api/merchant-logos/*`, `/api/instruments/{id}/logo`).
/// These routes need the session, so every request carries the same `Authorization` header as API calls
/// (spec: api/README.md §10, design/iconography-assets.md §3.3). Same name and behaviour as `LogoLoader` on Android.
///
/// - Memory cache of decoded bytes and of misses (404 / failure), so a list never refetches a missing logo.
/// - Disk cache: the transport's `URLCache` honors the server's `Cache-Control` (`private, max-age=86400` on 200,
///   `3600` on 404); see `LogoLoader.makeSession()`.
public actor LogoLoader {
    public typealias TokenProvider = @Sendable () async -> String?

    private let baseURL: URL
    private let transport: HTTPTransport
    private let token: TokenProvider
    private var cache: [String: Data] = [:]
    private var misses: Set<String> = []
    private var order: [String] = []
    private var inFlight: [String: Task<Data?, Never>] = [:]
    private let capacity: Int

    public init(baseURL: URL, transport: HTTPTransport = LogoLoader.makeSession(), capacity: Int = 300,
                token: @escaping TokenProvider) {
        self.baseURL = baseURL
        self.transport = transport
        self.capacity = capacity
        self.token = token
    }

    /// Session with a dedicated disk cache (50 MB) that follows HTTP caching headers.
    public static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 4 * 1024 * 1024, diskCapacity: 50 * 1024 * 1024, directory: nil)
        config.requestCachePolicy = .useProtocolCachePolicy
        return URLSession(configuration: config)
    }

    /// `logoPath` as returned by the API (relative, possibly signed `?s=`) resolved against the base URL.
    /// Never rebuild or re-encode the path: the HMAC covers it verbatim.
    public static func url(for logoPath: String, baseURL: URL) -> URL? {
        URL(string: logoPath, relativeTo: baseURL)?.absoluteURL
    }

    public static func request(for url: URL, token: String?) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("image/*", forHTTPHeaderField: "Accept")
        if let token, !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    /// Cached bytes if already loaded (no network).
    public func cached(_ logoPath: String) -> Data? { cache[logoPath] }

    /// Image bytes, or nil when there is no logo (404) or the request failed. Concurrent calls share one request.
    public func data(for logoPath: String) async -> Data? {
        if let hit = cache[logoPath] { return hit }
        if misses.contains(logoPath) { return nil }
        if let running = inFlight[logoPath] { return await running.value }
        let task = Task { await self.fetch(logoPath) }
        inFlight[logoPath] = task
        let result = await task.value
        inFlight[logoPath] = nil
        if let result {
            store(logoPath, result)
        } else {
            misses.insert(logoPath)
        }
        return result
    }

    private func fetch(_ logoPath: String) async -> Data? {
        guard let url = Self.url(for: logoPath, baseURL: baseURL) else { return nil }
        let request = Self.request(for: url, token: await token())
        guard let (data, response) = try? await transport.data(for: request),
              let status = (response as? HTTPURLResponse)?.statusCode,
              (200..<300).contains(status), !data.isEmpty else { return nil }
        return data
    }

    private func store(_ key: String, _ data: Data) {
        cache[key] = data
        order.removeAll { $0 == key }
        order.append(key)
        while order.count > capacity { cache[order.removeFirst()] = nil }
    }
}
