import XCTest
import CryptoKit
@testable import ReadingCapture

final class LibraryTests: XCTestCase {
    func sample() throws -> Clipping { try Clipping.make(quote: "  Exact quote\r\n@@IM:BUBBLE\n中文 🙂", book: "Book", app: "Skim", bundle: "test.reader") }
    func testEncryptedRoundTripAndAuthentication() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: url) }
        let key = SymmetricKey(size: .bits256), vault = try Vault(directory: url, key: key), clip = try sample()
        try vault.save(clip); XCTAssertEqual(try vault.load(), [clip])
        let file = url.appendingPathComponent(clip.id).appendingPathExtension("rcclip"), bytes = try Data(contentsOf: file)
        XCTAssertNil(bytes.range(of: Data(clip.quote.utf8)))
        let wrong = try Vault(directory: url, key: SymmetricKey(size: .bits256)); XCTAssertThrowsError(try wrong.load())
        XCTAssertEqual(try Data(contentsOf: file), bytes)
        var changed = clip; changed.comment = "My optional comment"; try vault.save(changed)
        XCTAssertEqual(try vault.load(), [changed]); XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: url.path).count, 1)
        var damaged = try Data(contentsOf: file); damaged[damaged.count - 1] ^= 1; try damaged.write(to: file)
        XCTAssertThrowsError(try vault.load()); XCTAssertEqual(try Data(contentsOf: file), damaged)
    }
    func testArchivePreservesExactTextAndRejectsDuplicates() throws {
        var clip = try sample(); clip.comment = "Line one\nLine two"
        XCTAssertEqual(try Exchange.decode(Exchange.archive([clip])), [clip])
        XCTAssertThrowsError(try Exchange.decode(Exchange.archive([clip, clip])))
        var invalid = clip; invalid.id = "../../outside"; XCTAssertThrowsError(try invalid.validate())
        XCTAssertThrowsError(try Exchange.decode(Data("{}".utf8)))
    }
    func testExportFixture() throws {
        var clip = try sample(); clip.comment = "Optional comment\nSecond line"
        let data = try Exchange.forward([clip]); XCTAssertTrue(String(decoding: data, as: UTF8.self).hasPrefix("#!im-style-forward 2\n"))
        if let path = ProcessInfo.processInfo.environment["CAPTURE_EXPORT_FIXTURE"] { try data.write(to: URL(fileURLWithPath: path)) }
    }
}
