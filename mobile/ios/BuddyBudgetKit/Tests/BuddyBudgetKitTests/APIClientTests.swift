import Foundation
import Testing
@testable import BuddyBudgetKit
import BuddyBudgetVectors

/// Records requests and replays canned responses.
final class StubTransport: HTTPTransport, @unchecked Sendable {
    struct Reply {
        let status: Int
        let body: String
        var headers: [String: String] = [:]
    }

    private let lock = NSLock()
    private var replies: [Reply]
    private(set) var requests: [URLRequest] = []

    init(_ replies: [Reply]) { self.replies = replies }
    convenience init(status: Int, body: String, headers: [String: String] = [:]) {
        self.init([Reply(status: status, body: body, headers: headers)])
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let reply = lock.withLock { () -> Reply in
            requests.append(request)
            return replies.count > 1 ? replies.removeFirst() : replies[0]
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: reply.headers)!
        return (Data(reply.body.utf8), response)
    }

    var last: URLRequest? { lock.withLock { requests.last } }
}

func makeClient(_ transport: StubTransport, token: String? = nil) -> APIClient {
    APIClient(baseURL: URL(string: "https://example.test/")!, session: InMemorySessionStore(token: token), transport: transport,
              userAgent: "BuddyBudget-iOS/test", acceptLanguage: { "it" })
}

/// Fixture under `spec/api/fixtures/`.
func fixture(_ name: String) throws -> Data {
    try Data(contentsOf: VectorSuite.specDirectory.appendingPathComponent("api/fixtures").appendingPathComponent(name))
}

func fixtureJSON(_ name: String, _ path: [String]) throws -> Data {
    var value: Any = try JSONSerialization.jsonObject(with: try fixture(name))
    for key in path { value = (value as! [String: Any])[key]! }
    return try JSONSerialization.data(withJSONObject: value)
}

@Test func decodesHealthAndIgnoresUnknownKeys() async throws {
    let transport = StubTransport(status: 200, body: #"{"status":"ok","uptime":12}"#)
    #expect(try await HealthAPI(client: makeClient(transport)).check().status == "ok")
    #expect(transport.last?.url?.path == "/api/health")
}

@Test func FOUNDATION_sendsBearerTokenVerbatimUserAgentAndLanguage() async throws {
    let signed = "abc.def+gh/ij="
    let transport = StubTransport(status: 200, body: #"{"status":"ok"}"#)
    _ = try await HealthAPI(client: makeClient(transport, token: signed)).check()
    let request = try #require(transport.last)
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer \(signed)")
    #expect(request.value(forHTTPHeaderField: "User-Agent") == "BuddyBudget-iOS/test")
    #expect(request.value(forHTTPHeaderField: "Accept-Language") == "it")
    #expect(request.value(forHTTPHeaderField: "Cookie") == nil)
}

@Test func SHELL056_unauthorizedClearsTokenAndNotifies() async {
    let transport = StubTransport(status: 401, body: "")
    let client = makeClient(transport, token: "t")
    let fired = Flag()
    client.events.set(onUnauthorized: { fired.set() }, onGate: nil)
    await #expect(throws: APIError.unauthorized) { try await HealthAPI(client: client).check() }
    #expect(client.session.readToken() == nil)
    #expect(fired.value)
}

@Test func SHELL056_gate403NotifiesWithCode() async {
    let transport = StubTransport(status: 403, body: #"{"code":"legal_acceptance_required","version":"2026-10-12"}"#)
    let client = makeClient(transport, token: "t")
    let gate = Box<APIErrorBody?>(nil)
    client.events.set(onUnauthorized: nil, onGate: { gate.value = $0 })
    await #expect(throws: APIError.self) { try await HealthAPI(client: client).check() }
    #expect(gate.value?.code == .legalAcceptanceRequired)
    #expect(gate.value?.version == "2026-10-12")
}

@Test func decodesErrorCodesFromFixture() throws {
    let body = APIErrorBody.parse(status: 400, data: try fixtureJSON("errors.json", ["validation_failed", "body"]))
    #expect(body.code == .validationFailed)
    #expect(body.field == "accountId")
    let notFound = APIErrorBody.parse(status: 404, data: try fixtureJSON("errors.json", ["category_not_found", "body"]))
    #expect(notFound.code == .other("category_not_found"))
    #expect(notFound.message == "Categoria non trovata")
    let otp = APIErrorBody.parse(status: 400, data: try fixtureJSON("auth-email-otp.json", ["wrongCode", "body"]))
    #expect(otp.code == .invalidOTP)
    #expect(APIErrorBody.parse(status: 429, data: Data(), retryAfter: " 42").retryAfter == 42)
}

@Test func AUTH001_signInStoresSignedHeaderTokenVerbatim() async throws {
    let header = "aaaaaaaa.bbb+cc/dd=="
    let body = String(decoding: try fixtureJSON("auth-email-otp.json", ["signIn", "body"]), as: UTF8.self)
    let transport = StubTransport(status: 200, body: body, headers: ["set-auth-token": header])
    let client = makeClient(transport)
    let token = try await AuthAPI(client: client).verifyCode(email: "a@b.it", code: "482913")
    #expect(token == header)
    #expect(client.session.readToken() == header)
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? [String: String]
    #expect(sent == ["email": "a@b.it", "otp": "482913"])
    #expect(transport.last?.url?.path == "/api/auth/sign-in/email-otp")
}

@Test func AUTH001_signInFallsBackToBodyToken() async throws {
    let transport = StubTransport(status: 200, body: #"{"token":"plain32","user":{}}"#)
    let client = makeClient(transport)
    #expect(try await AuthAPI(client: client).verifyCode(email: "a@b.it", code: "123456") == "plain32")
}

@Test func AUTH001_sendCodeBody() async throws {
    let transport = StubTransport(status: 200, body: #"{"success":true}"#)
    try await AuthAPI(client: makeClient(transport)).sendCode(email: "a@b.it")
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? [String: String]
    #expect(sent == ["email": "a@b.it", "type": "sign-in"])
}

@Test func AUTH023_signOutClearsToken() async {
    let transport = StubTransport(status: 200, body: #"{"success":true}"#)
    let client = makeClient(transport, token: "t")
    await AuthAPI(client: client).signOut()
    #expect(client.session.readToken() == nil)
    #expect(transport.last?.url?.path == "/api/auth/sign-out")
}

@Test func decodesBootstrapFixtures() throws {
    let me = try JSONDecoder().decode(MeBootstrap.self, from: try fixture("me-bootstrap.json"))
    #expect(me.gate == nil)
    #expect(me.profile.homePage == "/panoramica")
    #expect(me.capabilities.sections.pension)
    let fresh = try JSONDecoder().decode(MeBootstrap.self, from: try fixtureJSON("auth-email-otp.json", ["bootstrapAfterSignIn", "body"]))
    #expect(fresh.gate == .onboardingRequired)
    #expect(fresh.user.name == "")
}

@Test func exportFileNameFromContentDisposition() {
    #expect(UserAPI.fileName(contentDisposition: #"attachment; filename="buddybudget-export-2026-10-18.zip""#) == "buddybudget-export-2026-10-18.zip")
    #expect(UserAPI.fileName(contentDisposition: nil) == nil)
}

@Test func onboardingRequestOmitsUnsetFieldsAndKeepsNullKeys() throws {
    let request = OnboardingRequest(currency: "EUR", productCountry: "IT", language: "it",
                                    legal: LegalAcceptance(version: "2026-10-12"), notifications: .defaults,
                                    categories: [CategorySetupItem(key: nil, name: "Gatti", type: "dovuta", enabled: true)],
                                    aiCategorization: nil)
    let json = try JSONSerialization.jsonObject(with: try JSONEncoder().encode(request)) as! [String: Any]
    #expect(json["aiCategorization"] == nil)
    let categories = json["categories"] as! [[String: Any]]
    #expect(categories[0]["key"] is NSNull)
}

final class Flag: @unchecked Sendable {
    private let lock = NSLock()
    private var flag = false
    func set() { lock.withLock { flag = true } }
    var value: Bool { lock.withLock { flag } }
}

final class Box<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: T
    init(_ value: T) { stored = value }
    var value: T {
        get { lock.withLock { stored } }
        set { lock.withLock { stored = newValue } }
    }
}
