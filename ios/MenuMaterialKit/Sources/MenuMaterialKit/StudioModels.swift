import Foundation

/// `GET /api/native/styles`: the Photo Studio's looks, from the same catalog
/// the web uses (lib/photo-styles.ts), so the app never drifts from it.
public struct StyleCatalog: Codable, Sendable, Equatable {
    public struct Category: Codable, Sendable, Equatable, Identifiable, Hashable {
        public let id: String
        public let name: String
        public let description: String?
        public let use: String?
    }

    public struct Look: Codable, Sendable, Equatable, Identifiable, Hashable {
        public let id: String
        public let name: String
        public let cue: String
        public let category: String?
        public let description: String?
        public let bestFor: String?
        public let traits: [String]
        /// Food Fantasy looks need Pro.
        public let pro: Bool
        /// The plate control a new photo in this look starts with.
        public let plate: String
        /// Path of the full example, such as /studio/styles/menu-stone.webp.
        public let image: String
        /// Path of the 400 px tile.
        public let thumbnail: String
        /// The art direction sent as `style.photoStyle`, with the original
        /// angle kept.
        public let photoStyle: String
        /// The catalog ID for `style.photoPreset`; "" for Polish my original.
        public let photoPreset: String
    }

    public let categories: [Category]
    /// "Polish my original": the default, free look.
    public let polish: Look
    public let styles: [Look]

    public func looks(in category: Category) -> [Look] {
        styles.filter { $0.category == category.id }
    }

    public func look(id: String) -> Look? {
        id == polish.id ? polish : styles.first { $0.id == id }
    }
}

/// The photo shapes the Studio offers, named by use.
public enum PhotoFormat: String, Codable, CaseIterable, Sendable, Identifiable {
    case menu, feed, story, doordash

    public var id: String { rawValue }

    public var name: String {
        switch self {
        case .menu: "Square"
        case .feed: "Portrait"
        case .story: "Story"
        case .doordash: "Wide"
        }
    }

    public var use: String {
        switch self {
        case .menu: "Menu & website"
        case .feed: "Instagram post"
        case .story: "Instagram Story"
        case .doordash: "Delivery apps"
        }
    }

    /// Width over height.
    public var ratio: Double {
        switch self {
        case .menu: 1
        case .feed: 4.0 / 5.0
        case .story: 9.0 / 16.0
        case .doordash: 16.0 / 9.0
        }
    }
}

/// `POST /api/jobs`: make one image from an uploaded photo in a look.
public struct PhotoRequest: Encodable, Sendable {
    public struct Style: Encodable, Sendable {
        public let photoPreset: String
        public let photoStyle: String
        public let referenceIds: [String]
    }

    public struct LookContext: Encodable, Sendable {
        public let presetId: String
        public let occasionId = ""
        public let overrides: [String] = []
    }

    public struct Controls: Encodable, Sendable {
        public let format: String
        public let surface = "As shown"
        public let lighting = "As shown"
        public let plate: String
        public let angle = "keep"
        public let composition = "Full dish"
        public let cropX = 50
        public let cropY = 50
        public let zoom = 1
    }

    /// New for every attempt; the server's idempotency key.
    public let requestKey: String
    public let dishId: String
    public let sourceId: String
    /// The optional "Details" note.
    public let revision: String
    public let candidateCount = 1
    public let editMode = "preserve"
    public let style: Style
    public let lookContext: LookContext
    public let controls: Controls

    public init(
        look: StyleCatalog.Look,
        format: PhotoFormat,
        note: String,
        dishId: String,
        sourceId: String,
        requestKey: String = UUID().uuidString.lowercased()
    ) {
        self.requestKey = requestKey
        self.dishId = dishId
        self.sourceId = sourceId
        revision = String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(500))
        style = Style(photoPreset: look.photoPreset, photoStyle: look.photoStyle, referenceIds: [])
        lookContext = LookContext(presetId: look.id)
        controls = Controls(format: format.rawValue, plate: look.plate)
    }
}

/// The 202 answer to `POST /api/jobs`: the job row. `reused` means an
/// identical photo was already made, and no image was used.
public struct JobReply: Decodable, Sendable, Equatable {
    public let id: String
    public let status: String
    public let reused: Bool?
    public let createdAt: Double?
}

/// `GET /api/jobs/status`: unfinished work only. When something changes or
/// drops out, the workspace has news.
public struct JobStatus: Decodable, Sendable, Equatable {
    public struct Item: Decodable, Sendable, Equatable {
        public let id: String
        public let status: String
    }

    public struct OutputItem: Decodable, Sendable, Equatable {
        public let id: String
        public let jobId: String
        public let status: String
        public let error: String?
    }

    public let jobs: [Item]
    public let outputs: [OutputItem]
}

/// Where a photo stands, read from the workspace.
public enum PhotoOutcome: Equatable, Sendable {
    case waiting(RenderProgress, hold: String?)
    case ready(assetId: String)
    case failed(String)
}

extension Workspace {
    /// What has become of a job: its finished photo, its failure, or how far
    /// along it is, measured on the server's clock.
    public func outcome(of jobId: String, now serverNow: Double) -> PhotoOutcome? {
        let jobOutputs = outputs(for: jobId)
        if let done = jobOutputs.first(where: { $0.status == "completed" }), let asset = done.assetId {
            return .ready(assetId: asset)
        }
        guard let job = jobs.first(where: { $0.id == jobId }) else { return nil }
        if job.status == "failed" || job.status == "partial" {
            return .failed(
                jobOutputs.compactMap(\.error).first
                    ?? "This photo couldn’t be made. It wasn’t counted against your images."
            )
        }
        let sent = jobOutputs
            .filter { !$0.isFinished }
            .compactMap(\.submittedAt)
            .min()
        let queued = job.status == "queued"
        let queuedFor = serverNow - job.createdAt
        let progress = RenderProgress(
            queuedFor: queuedFor,
            sentFor: sent.map { serverNow - $0 } ?? (queued ? nil : queuedFor),
            typical: job.estimateMs ?? 45000
        )
        let hold = jobOutputs.first { $0.status == "queued" && $0.error != nil }?.error
        return .waiting(progress, hold: hold)
    }
}
