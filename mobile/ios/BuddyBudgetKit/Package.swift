// swift-tools-version: 6.0
import PackageDescription

// Domain + Data with no UIKit/SwiftUI dependency, so `swift test` runs the shared
// golden vectors on any Mac or CI runner without a simulator.
// `swift run vector-check` runs the same vectors without XCTest/Swift Testing
// (for machines with only the Command Line Tools).
let package = Package(
    name: "BuddyBudgetKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "BuddyBudgetKit", targets: ["BuddyBudgetKit"])],
    targets: [
        .target(
            name: "BuddyBudgetKit",
            // Copy of spec/domain/locale-data/locale-data.json. Refresh after a spec bump with
            //   cp ../spec/domain/locale-data/locale-data.json Sources/BuddyBudgetKit/Domain/LocaleData/
            // (vector-check and the tests fail while the two copies differ).
            resources: [.copy("Domain/LocaleData/locale-data.json")]
        ),
        // Golden-vector adapters shared by the tests and `vector-check`.
        .target(name: "BuddyBudgetVectors", dependencies: ["BuddyBudgetKit"]),
        .executableTarget(name: "vector-check", dependencies: ["BuddyBudgetVectors"]),
        .testTarget(name: "BuddyBudgetKitTests", dependencies: ["BuddyBudgetKit", "BuddyBudgetVectors"],
                    exclude: ["Fixtures"]), // read from disk via #filePath
    ]
)
