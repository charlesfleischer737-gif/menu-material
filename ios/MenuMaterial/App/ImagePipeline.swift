import MenuMaterialKit
import SwiftUI
import UIKit

/// Loads the restaurant's private photos (`/api/assets/<id>`, which needs
/// the session) and keeps recent ones in memory.
final class ImagePipeline {
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
        let task = Task<UIImage?, Never> { [client] in
            let query = original ? [URLQueryItem(name: "original", value: "1")] : []
            guard let data = try? await client.data("assets/\(id)", query: query) else { return nil }
            return UIImage(data: data)
        }
        running[key as String] = task
        let image = await task.value
        running[key as String] = nil
        if let image {
            cache.setObject(image, forKey: key, cost: Int(image.size.width * image.size.height * image.scale * 4))
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

    var body: some View {
        ZStack {
            Rectangle().fill(Palette.raised)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            }
        }
        .clipped()
        .task(id: id) {
            let loaded = await model.images.image(asset: id, original: original)
            withAnimation(.easeOut(duration: 0.25)) { image = loaded }
        }
        .accessibilityHidden(image == nil)
    }
}
