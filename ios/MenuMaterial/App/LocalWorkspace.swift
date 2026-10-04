import CryptoKit
import Foundation

/// Device-only drafts and cached responses. A session has its own protected
/// directory; sign-out removes it. Tokens are never written here.
final class LocalWorkspace {
    private(set) var directory: URL?
    var failure: String?

    func configure(session: String?) {
        guard let session else { directory = nil; return }
        let digest = SHA256.hash(data: Data(session.utf8)).map { String(format: "%02x", $0) }.joined()
        var url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "Workspace/\(digest)", directoryHint: .isDirectory)
        do {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            var values = URLResourceValues(); values.isExcludedFromBackup = true
            try url.setResourceValues(values)
            directory = url
        } catch { failure = "This device couldn’t save your draft. Free some storage and try again." }
    }
    func data(_ key: String) -> Data? {
        guard let directory else { return nil }
        return try? Data(contentsOf: directory.appending(path: key))
    }
    @discardableResult func save(_ data: Data, _ key: String) -> Bool {
        guard let directory else { return false }
        do {
            try data.write(to: directory.appending(path: key), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            failure = nil
            if key.hasPrefix("image-") { trimImages() }
            return true
        } catch { failure = "This device couldn’t save your draft. Free some storage and try again."; return false }
    }
    func read<T: Decodable>(_ key: String, as: T.Type = T.self) -> T? {
        data(key).flatMap { try? JSONDecoder().decode(T.self, from: $0) }
    }
    @discardableResult func save<T: Encodable>(_ value: T, _ key: String) -> Bool {
        guard let data = try? JSONEncoder().encode(value) else { return false }
        return save(data, key)
    }
    private func trimImages() {
        guard let directory, let files = try? FileManager.default.contentsOfDirectory(at: directory,
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]) else { return }
        let images = files.filter { $0.lastPathComponent.hasPrefix("image-") }.compactMap { url -> (URL, Int, Date)? in
            guard let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) else { return nil }
            return (url, values.fileSize ?? 0, values.contentModificationDate ?? .distantPast)
        }.sorted { $0.2 < $1.2 }
        var bytes = images.reduce(0) { $0 + $1.1 }
        for (url, size, _) in images where bytes > 80 * 1024 * 1024 {
            try? FileManager.default.removeItem(at: url); bytes -= size
        }
    }
    func remove(_ key: String) {
        guard let directory else { return }
        try? FileManager.default.removeItem(at: directory.appending(path: key))
    }
    func clear() {
        if let directory { try? FileManager.default.removeItem(at: directory) }
        directory = nil
        failure = nil
    }
}
