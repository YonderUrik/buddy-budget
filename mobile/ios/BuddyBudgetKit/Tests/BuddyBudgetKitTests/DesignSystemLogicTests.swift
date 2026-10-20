import Foundation
import Testing
@testable import BuddyBudgetKit

// Design system v1 logic (spec: design/components.md §3.1–3.2, §3.7, §3.10; design/charts.md §1, §4).
// The same cases run on Android in core/src/test/.../DesignSystemLogicTest.kt.

private let nbsp = "\u{00A0}"

// MARK: - AmountText color and privacy rules

@Test func DS_amountToneRoles() {
    #expect(AmountDisplay.role(for: -1, tone: .neutral) == .foreground)
    #expect(AmountDisplay.role(for: -1, tone: .auto) == .neg)
    #expect(AmountDisplay.role(for: 0, tone: .auto) == .pos)
    #expect(AmountDisplay.role(for: 5, tone: .auto) == .pos)
    #expect(AmountDisplay.role(for: 5, tone: .signed) == .pos)
    #expect(AmountDisplay.role(for: 0, tone: .signed) == .foreground)
    #expect(AmountDisplay.role(for: -5, tone: .signed) == .neg)
    #expect(AmountDisplay.role(for: 5, tone: .income) == .pos)
    #expect(AmountDisplay.role(for: -5, tone: .income) == .foreground)
    #expect(AmountDisplay.role(for: -5, tone: .pos) == .pos)
    #expect(AmountDisplay.role(for: 5, tone: .neg) == .neg)
}

@Test func DS_amountTextFormats() {
    let plain = AmountDisplay.make(value: -1234.5, currency: "EUR", locale: .itIT)
    #expect(plain.text == "-1234,50\(nbsp)€")
    #expect(plain.tail.isEmpty)
    let signed = AmountDisplay.make(value: -1234.5, currency: "EUR", locale: .itIT, tone: .signed, signed: true)
    #expect(signed.text == "\u{2212}1234,50\(nbsp)€")
    #expect(signed.role == .neg)
    let income = AmountDisplay.make(value: 20, currency: "EUR", locale: .enGB, tone: .income, signed: true)
    #expect(income.text == "+€20.00")
    let whole = AmountDisplay.make(value: 30673.12, currency: "EUR", locale: .itIT, maximumFractionDigits: 0)
    #expect(whole.text == "30.673\(nbsp)€")
}

@Test func DS_amountTextHeroSplit() {
    let it = AmountDisplay.make(value: 30673.12, currency: "EUR", locale: .itIT, split: true)
    #expect(it.main == "30.673")
    #expect(it.tail == ",12\(nbsp)€")
    let en = AmountDisplay.make(value: 30673.12, currency: "EUR", locale: .enGB, split: true)
    #expect(en.main == "€30,673")
    #expect(en.tail == ".12")
    let signed = AmountDisplay.make(value: -120.5, currency: "EUR", locale: .itIT, tone: .signed, signed: true, split: true)
    #expect(signed.main == "\u{2212}120")
    #expect(signed.tail == ",50\(nbsp)€")
}

@Test func DS_amountTextPrivacyMaskKeepsColor() {
    let masked = AmountDisplay.make(value: -50, currency: "EUR", locale: .itIT, tone: .auto, signed: true, split: true, masked: true)
    #expect(masked.text == "\u{2022}\u{2022}\u{2022}\u{2022}")
    #expect(masked.tail.isEmpty)
    #expect(masked.isMasked)
    #expect(masked.role == .neg)
}

@Test func DS_merchantInitial() {
    #expect(MerchantInitial.of("netflix") == "N")
    #expect(MerchantInitial.of("  3bee") == "3")
    #expect(MerchantInitial.of("«élite»") == "É")
    #expect(MerchantInitial.of("—") == "\u{00B7}")
    #expect(MerchantInitial.of("") == "\u{00B7}")
}

@Test func DS_amountInputNormalization() {
    #expect(AmountInput.normalize("12.5", locale: .itIT) == "12,5")
    #expect(AmountInput.normalize("12,5", locale: .enGB) == "12.5")
    #expect(AmountInput.normalize("1.234,56", locale: .deDE) == "1,23456")
    #expect(AmountInput.normalize("\u{2212}7a", locale: .itIT) == "-7")
    #expect(AmountInput.normalize("7-", locale: .itIT) == "7")
}

// MARK: - Chart scaling (charts.md §4.4 golden vectors, recharts 3.8.1)

@Test(arguments: [
    ([0, 1234], [0, 350, 700, 1050, 1400]),
    ([0, 87.5], [0, 25, 50, 75, 100]),
    ([-3200, 5400], [-6000, -3000, 0, 3000, 6000]),
    ([0.012, 0.087], [0, 0.025, 0.05, 0.075, 0.1]),
    ([-0.153, 0], [-0.16, -0.12, -0.08, -0.04, 0]),
    ([100, 100], [98, 99, 100, 101, 102]),
    ([0, 0], [0, 1, 2, 3, 4]),
    ([1520.3, 2210.9], [1500, 1750, 2000, 2250, 2500]),
    ([-50, -10], [-50, -40, -30, -20, -10]),
    ([0, 1], [0, 0.25, 0.5, 0.75, 1]),
] as [([Double], [Double])])
func DS_chartNiceTicks(domain: [Double], expected: [Double]) {
    #expect(ChartScale.niceTicks(min: domain[0], max: domain[1]) == expected)
}

@Test func DS_chartHeroDomainAndProjection() {
    #expect(ChartScale.heroDomain([100, 200]) == 90...202)
    #expect(ChartScale.heroDomain([-100, 50]) == -100...50.5)
    #expect(ChartScale.heroDomain([0, 0]) == -1...1)
    let d = 0.0...100.0
    #expect(ChartScale.y(100, domain: d, top: 8, height: 200) == 8)
    #expect(ChartScale.y(0, domain: d, top: 8, height: 200) == 208)
    #expect(ChartScale.x(index: 2, count: 5, width: 400) == 200)
    #expect(ChartScale.x(index: 0, count: 1, width: 400) == 200)
}

@Test func DS_chartScrubIndexAndTooltipClamp() {
    #expect(ChartScale.scrubIndex(x: -20, plotWidth: 300, count: 31) == 0)
    #expect(ChartScale.scrubIndex(x: 155, plotWidth: 300, count: 31) == 16)
    #expect(ChartScale.scrubIndex(x: 400, plotWidth: 300, count: 31) == 30)
    #expect(ChartScale.scrubIndex(x: 10, plotWidth: 300, count: 1) == 0)
    #expect(abs(ChartScale.tooltipCenterX(5, width: 100) - 14) < 1e-9)
    #expect(ChartScale.tooltipCenterX(50, width: 100) == 50)
    #expect(abs(ChartScale.tooltipCenterX(99, width: 100) - 86) < 1e-9)
}

// MARK: - Curves (d3-shape 3.2 curveMonotoneX output; smoothPath; stepAfter)

private func rounded(_ commands: [ChartPathCommand]) -> [[Double]] {
    func r(_ v: Double) -> Double { (v * 1000).rounded() / 1000 }
    return commands.map {
        switch $0 {
        case .move(let p): [0, r(p.x), r(p.y)]
        case .line(let p): [1, r(p.x), r(p.y)]
        case .cubic(let a, let b, let c): [2, r(a.x), r(a.y), r(b.x), r(b.y), r(c.x), r(c.y)]
        case .arc(let c, let radius, let s, let w): [3, r(c.x), r(c.y), r(radius), r(s), r(w)]
        case .close: [4]
        }
    }
}

@Test func DS_chartMonotoneMatchesD3() {
    let pts = [(0.0, 10.0), (1, 30), (2, 20), (3, 25), (4, 5)].map { ChartPoint(x: $0.0, y: $0.1) }
    // M0,10C0.333,20,0.667,30,1,30C1.333,30,1.667,20,2,20C2.333,20,2.667,25,3,25C3.333,25,3.667,15,4,5
    #expect(rounded(ChartPaths.line(pts, curve: .monotone)) == [
        [0, 0, 10],
        [2, 0.333, 20, 0.667, 30, 1, 30],
        [2, 1.333, 30, 1.667, 20, 2, 20],
        [2, 2.333, 20, 2.667, 25, 3, 25],
        [2, 3.333, 25, 3.667, 15, 4, 5],
    ])
    // M0,5C0.667,5,1.333,5,2,5C3,5,4,6.5,5,8
    let uneven = [(0.0, 5.0), (2, 5), (5, 8)].map { ChartPoint(x: $0.0, y: $0.1) }
    #expect(rounded(ChartPaths.line(uneven, curve: .monotone)) == [
        [0, 0, 5], [2, 0.667, 5, 1.333, 5, 2, 5], [2, 3, 5, 4, 6.5, 5, 8],
    ])
    let two = [ChartPoint(x: 0, y: 0), ChartPoint(x: 10, y: 10)]
    #expect(rounded(ChartPaths.line(two, curve: .monotone)) == [[0, 0, 0], [1, 10, 10]])
}

@Test func DS_chartSmoothStepAndArea() {
    let pts = [ChartPoint(x: 0, y: 10), ChartPoint(x: 10, y: 0)]
    #expect(rounded(ChartPaths.line(pts, curve: .smooth)) == [[0, 0, 10], [2, 5, 10, 5, 0, 10, 0]])
    #expect(rounded(ChartPaths.line(pts, curve: .stepAfter)) == [[0, 0, 10], [1, 10, 10], [1, 10, 0]])
    #expect(rounded(ChartPaths.area(pts, curve: .linear, baselineY: 20)) == [[0, 0, 10], [1, 10, 0], [1, 10, 20], [1, 0, 20], [4]])
}

@Test func DS_sparklineGeometry() {
    let p = SparklineGeometry.points([10, 20, 15], width: 84, height: 30)
    #expect(p == [ChartPoint(x: 0, y: 28), ChartPoint(x: 42, y: 2), ChartPoint(x: 84, y: 15)])
    let flat = SparklineGeometry.points([5, 5], width: 84, height: 30)
    #expect(flat.map(\.y) == [28, 28])
    #expect(SparklineGeometry.points([1], width: 84, height: 30).isEmpty)
}

// MARK: - Donut (Recharts Pie angles: 3 o'clock, counter-clockwise, paddingAngle)

@Test func DS_donutSliceAngles() {
    let two = DonutGeometry.slices([1, 1], paddingAngle: 2)
    #expect(two == [.init(startAngle: 0, endAngle: 178), .init(startAngle: 180, endAngle: 358)])
    let withZero = DonutGeometry.slices([3, 0, 1], paddingAngle: 2)
    #expect(withZero.map { ($0.endAngle * 1000).rounded() / 1000 } == [267, 267, 358])
    #expect(withZero[1].startAngle == 267)
    #expect(DonutGeometry.slices([5], paddingAngle: 2) == [.init(startAngle: 0, endAngle: 360)])
    #expect(DonutGeometry.slices([0, 0]).allSatisfy { $0.startAngle == $0.endAngle })
}

@Test func DS_donutHitTestAndSector() {
    let slices = DonutGeometry.slices([1, 1], paddingAngle: 2)
    // Right of center, slightly above → angle ≈ 10° → first slice; below the center → second slice.
    #expect(DonutGeometry.hitTest(x: 180, y: 85, cx: 100, cy: 100, innerRadius: 62, outerRadius: 90, slices: slices) == 0)
    #expect(DonutGeometry.hitTest(x: 100, y: 180, cx: 100, cy: 100, innerRadius: 62, outerRadius: 90, slices: slices) == 1)
    #expect(DonutGeometry.hitTest(x: 100, y: 100, cx: 100, cy: 100, innerRadius: 62, outerRadius: 90, slices: slices) == nil)
    let path = DonutGeometry.sectorPath(cx: 100, cy: 100, innerRadius: 62, outerRadius: 90,
                                        startAngle: 0, endAngle: 90, cornerRadius: 4)
    // move + corner + outer arc + corner + line + corner + inner arc + corner + close
    #expect(path.count == 9)
    guard case .move(let start) = path[0] else { Issue.record("expected move"); return }
    // Start line tangency sits on the 0° ray just inside the outer radius (centerRadius·cosθ).
    #expect(abs(start.y - 100) < 1e-9)
    #expect(start.x > 100 + 85 && start.x < 190)
    guard case .arc(_, let r, _, let sweep) = path[2] else { Issue.record("expected outer arc"); return }
    #expect(r == 90)
    #expect(sweep < 0 && sweep > -90) // counter-clockwise on screen, shortened by the corners
}

// MARK: - Logo loader

private final class Recorder: @unchecked Sendable {
    var requests: [URLRequest] = []
}

private struct LogoTransport: HTTPTransport {
    let status: Int
    let recorder: Recorder
    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        recorder.requests.append(request)
        return (status == 200 ? Data([1, 2, 3]) : Data(), HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
    }
}

@Test func DS_logoUrlKeepsSignature() {
    let base = URL(string: "http://localhost:3001/")!
    let url = LogoLoader.url(for: "/api/merchant-logos/name/Caff%C3%A8?s=abc123", baseURL: base)
    #expect(url?.absoluteString == "http://localhost:3001/api/merchant-logos/name/Caff%C3%A8?s=abc123")
}

@Test func DS_logoLoaderSendsAuthorizationAndCaches() async {
    let recorder = Recorder()
    let loader = LogoLoader(baseURL: URL(string: "https://example.test/")!,
                            transport: LogoTransport(status: 200, recorder: recorder)) { "tok" }
    let first = await loader.data(for: "/api/merchant-logos/netflix.com?s=1")
    let second = await loader.data(for: "/api/merchant-logos/netflix.com?s=1")
    #expect(first == Data([1, 2, 3]))
    #expect(second == first)
    #expect(recorder.requests.count == 1)
    #expect(recorder.requests.first?.value(forHTTPHeaderField: "Authorization") == "Bearer tok")
}

@Test func DS_logoLoaderRemembersMisses() async {
    let recorder = Recorder()
    let loader = LogoLoader(baseURL: URL(string: "https://example.test/")!,
                            transport: LogoTransport(status: 404, recorder: recorder)) { nil }
    #expect(await loader.data(for: "/api/merchant-logos/none.com") == nil)
    #expect(await loader.data(for: "/api/merchant-logos/none.com") == nil)
    #expect(recorder.requests.count == 1)
    #expect(recorder.requests.first?.value(forHTTPHeaderField: "Authorization") == nil)
}
