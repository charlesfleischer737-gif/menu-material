import MenuMaterialKit
import SwiftUI
import UIKit

/// Loads the restaurant's private photos (`/api/assets/<id>`, which needs
/// the session) and keeps recent ones in memory.
final class ImagePipeline {
    var local: LocalWorkspace?
    private let client: APIClient
    private let cache = NSCache<NSString, UIImage>()
    private var running: [String: Task<UIImage?, Never>] = [:]

    init(client: APIClient) {
        self.client = client
        cache.totalCostLimit = 200 * 1024 * 1024
    }

    /// The working copy, or with `original` the photo as it was uploaded.
    func image(asset id: String, original: Bool = false) async -> UIImage? {
        let key = "\(id):\(original)" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        if let task = running[key as String] { return await task.value }
        let account = client.sessionToken
        let diskKey = "image-\(id)-\(original).data"
        if let bytes = local?.data(diskKey), let image = UIImage(data: bytes) {
            cache.setObject(image, forKey: key); return image
        }
        let task = Task<UIImage?, Never> { [client, local] in
            let query = original ? [URLQueryItem(name: "original", value: "1")] : []
            guard let data = try? await client.data("assets/\(id)", query: query) else { return nil }
            guard client.sessionToken == account, !Task.isCancelled else { return nil }
            if !original { local?.save(data, diskKey) }
            return UIImage(data: data)
        }
        running[key as String] = task
        let image = await task.value
        running[key as String] = nil
        guard client.sessionToken == account else { return nil }
        if let image {
            cache.setObject(image, forKey: key, cost: Int(image.size.width * image.size.height * image.scale * image.scale * 4))
        }
        return image
    }

    /// The full-quality file for saving or sharing. The server only hands
    /// out a made photo once it has been chosen for use.
    func download(asset id: String) async throws -> Data {
        try await client.data(
            "assets/\(id)",
            query: [URLQueryItem(name: "original", value: "1"), URLQueryItem(name: "download", value: "1")]
        )
    }

    func clear() {
        running.values.forEach { $0.cancel() }; running.removeAll(); cache.removeAllObjects()
    }

    func remember(_ image: UIImage, asset id: String) {
        cache.setObject(image, forKey: "\(id):false" as NSString)
    }
}

/// A private photo from the workspace, faded in once loaded, as in Photos.
struct AssetImage: View {
    @Environment(AppModel.self) private var model
    let id: String
    var original = false
    var contentMode: ContentMode = .fill
    @State private var image: UIImage?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        ZStack {
            Rectangle().fill(Palette.raised)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            } else if failed {
                Button { attempt += 1 } label: { Label("Retry photo", systemImage: "arrow.clockwise").font(.caption) }
                    .buttonStyle(.bordered).accessibilityLabel("Photo unavailable. Retry loading")
            } else { ProgressView() }
        }
        .clipped()
        .task(id: "\(id)-\(original)-\(attempt)") {
            failed = false
            let loaded = await model.images.image(asset: id, original: original)
            withAnimation(.easeOut(duration: 0.25)) { image = loaded; failed = loaded == nil }
        }
        .accessibilityElement(children: .contain)
    }
}
