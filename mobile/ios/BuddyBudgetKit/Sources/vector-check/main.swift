import BuddyBudgetVectors
import Foundation

// Runs every golden vector covered by BuddyBudgetKit without XCTest / Swift Testing.
// Usage: swift run vector-check [--verbose] [file.json …]   (exit code 1 on any failure)

let requested = CommandLine.arguments.dropFirst().filter { !$0.hasPrefix("--") }
let files = requested.isEmpty ? VectorSuite.files : requested
var failures = 0

if let mismatch = VectorSuite.localeDataMismatch() {
    print("FAIL locale-data: \(mismatch)")
    failures += 1
}

for file in files {
    let vectors: [Vector]
    do {
        vectors = try VectorSuite.load(file)
    } catch {
        print("FAIL \(file): cannot load (\(error))")
        failures += 1
        continue
    }
    var passed = 0, skipped = 0, serverSide = 0, failed = 0
    var skipReasons: [String: Int] = [:]
    for vector in vectors {
        switch VectorSuite.run(vector) {
        case .pass:
            passed += 1
        case .skip(let reason):
            if reason.hasPrefix("server-side:") { serverSide += 1 } else { skipped += 1 }
            skipReasons["\(vector.function): \(reason)", default: 0] += 1
        case .fail(let message):
            failed += 1
            print("  FAIL [\(vector.id)] \(vector.function): \(message)")
        }
    }
    failures += failed
    print("\(failed == 0 ? "ok  " : "FAIL") \(file): \(passed) passed, \(failed) failed, \(serverSide) server-side, \(skipped) skipped (\(vectors.count) total)")
    if CommandLine.arguments.contains("--verbose") || ProcessInfo.processInfo.environment["VERBOSE"] != nil {
        for (reason, count) in skipReasons.sorted(by: { $0.key < $1.key }) { print("       not run \(count)× \(reason)") }
    }
}

print(failures == 0 ? "All vectors passed." : "\(failures) failure(s).")
exit(failures == 0 ? 0 : 1)
