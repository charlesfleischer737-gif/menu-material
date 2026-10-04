import Foundation

nonisolated enum SharedPhotoInbox {
    static let group = "group.com.menumaterial.app"
    static func directory() throws -> URL {
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            throw InboxError.unavailable
        }
        var folder = root.appending(path: "PhotoInbox", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try folder.setResourceValues(values)
        return folder
    }
    static func save(_ data: Data) throws {
        guard data.count <= 20 * 1024 * 1024 else { throw InboxError.tooLarge }
        let folder = try directory()
        let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
        guard files.count < 10 else { throw InboxError.full }
        try data.write(to: folder.appending(path: "\(UUID().uuidString).photo"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func next() -> URL? {
        guard let folder = try? directory() else { return nil }
        return (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.creationDateKey]))?
            .filter { $0.pathExtension == "photo" }.sorted { $0.lastPathComponent < $1.lastPathComponent }.first
    }
    enum InboxError: LocalizedError {
        case unavailable, tooLarge, full
        var errorDescription: String? {
            switch self {
            case .unavailable: "Sharing isn’t available in this build. Open Menu Material and choose the photo from your library."
            case .tooLarge: "Choose a photo smaller than 20 MB."
            case .full: "Open Menu Material to finish your saved photos before adding more."
            }
        }
    }
}
