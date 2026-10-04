import Foundation

/// `GET /api/state` for a signed-in owner: the restaurant and everything in
/// it. Signed out, `user` is nil. Database rows keep their snake_case column
/// names on the wire; the decoder reads them into camelCase. SQLite flags
/// such as `available` arrive as 0 or 1.
public struct Workspace: Decodable, Sendable, Equatable {
    public let user: User?
    public let signIn: SignInMethods?
    public let emailVerification: EmailVerification?
    public let studioAvailability: StudioAvailability?
    public let restaurant: Restaurant?
    public let remaining: Int?
    public let freeImages: FreeImages?
    public let billing: BillingSummary?
    public let aiConnected: Bool?
    public let imagesAvailable: Bool?
    /// The origin for guest menu links and QR codes.
    public let menuOrigin: String?
    public let workerHealthy: Bool?
    public var dishes: [Dish]
    public var assets: [Asset]
    public var jobs: [Job]
    public var outputs: [Output]
    public let serverTime: Double?

    enum CodingKeys: String, CodingKey {
        case user, signIn, emailVerification, studioAvailability, restaurant, remaining
        case freeImages, billing, aiConnected, imagesAvailable, menuOrigin, workerHealthy
        case dishes, assets, jobs, outputs, serverTime
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user = try c.decodeIfPresent(User.self, forKey: .user)
        signIn = try? c.decodeIfPresent(SignInMethods.self, forKey: .signIn)
        emailVerification = try? c.decodeIfPresent(EmailVerification.self, forKey: .emailVerification)
        studioAvailability = try? c.decodeIfPresent(StudioAvailability.self, forKey: .studioAvailability)
        restaurant = try c.decodeIfPresent(Restaurant.self, forKey: .restaurant)
        remaining = try? c.decodeIfPresent(Int.self, forKey: .remaining)
        freeImages = try? c.decodeIfPresent(FreeImages.self, forKey: .freeImages)
        billing = try? c.decodeIfPresent(BillingSummary.self, forKey: .billing)
        aiConnected = try? c.decodeIfPresent(Bool.self, forKey: .aiConnected)
        imagesAvailable = try? c.decodeIfPresent(Bool.self, forKey: .imagesAvailable)
        menuOrigin = try? c.decodeIfPresent(String.self, forKey: .menuOrigin)
        workerHealthy = try? c.decodeIfPresent(Bool.self, forKey: .workerHealthy)
        // One unexpected row never hides the rest.
        dishes = (try? c.decodeIfPresent(LossyArray<Dish>.self, forKey: .dishes))?.elements ?? []
        assets = (try? c.decodeIfPresent(LossyArray<Asset>.self, forKey: .assets))?.elements ?? []
        jobs = (try? c.decodeIfPresent(LossyArray<Job>.self, forKey: .jobs))?.elements ?? []
        outputs = (try? c.decodeIfPresent(LossyArray<Output>.self, forKey: .outputs))?.elements ?? []
        serverTime = try? c.decodeIfPresent(Double.self, forKey: .serverTime)
    }

    /// Dishes on the menu today: not archived, not samples.
    public var activeDishes: [Dish] {
        dishes.filter { $0.archivedAt == nil && $0.sample == 0 }
    }

    /// The photo that stands for a dish, as the web picks it: the chosen
    /// main photo, else the newest approved one, else the newest.
    public func preferredPhoto(for dish: Dish) -> Asset? {
        let photos = assets.filter {
            $0.dishId == dish.id && ["source", "generated", "edited"].contains($0.kind) && $0.needsCorrection == 0
        }
        return photos.first { $0.id == dish.preferredPhotoId && $0.approvedAt != nil }
            ?? photos.first { $0.approvedAt != nil }
            ?? photos.first
    }

    public func photos(for dishId: String) -> [Asset] {
        assets.filter { $0.dishId == dishId && ["source", "generated", "edited"].contains($0.kind) }
    }

    public func outputs(for jobId: String) -> [Output] {
        outputs.filter { $0.jobId == jobId }
    }

    public var canCreateImages: Bool {
        (aiConnected ?? true) && (imagesAvailable ?? true) && (studioAvailability?.creationEnabled ?? true)
    }
}

public struct StudioAvailability: Decodable, Sendable, Equatable {
    public let creationEnabled: Bool
    public let disabledStyleIds: [String]?
    public let message: String?
}

/// Free images held back or already used, for the note by the balance.
public struct FreeImages: Decodable, Sendable, Equatable {
    /// "verification", "held" or "used".
    public let status: String
    public let images: Int?
    public let days: Int?
}

public struct Restaurant: Decodable, Sendable, Equatable {
    public let nativeProfile: RestaurantProfile?
    public let id: String
    public let name: String
    public let slug: String?
    public let currency: String?
    public let timezone: String?
    public let cuisine: String?
    public let logoId: String?
    public let publicSuspended: Int?
}

public struct Dish: Decodable, Sendable, Equatable, Identifiable, Hashable {
    public let id: String
    public var name: String
    public var description: String
    public var category: String
    /// Hundredths of the restaurant's currency; 0 means no price yet.
    public var price: Int
    /// 0 when sold out.
    public var available: Int
    public var dietary: [String]
    public var preferredPhotoId: String?
    public var archivedAt: Double?
    public var confirmedAt: Double?
    public var revision: Int
    public var updatedAt: Double?
    public let createdAt: Double
    public var sample: Int
    public var preserve: String
    public var portion: String
    public var plating: String
    public var setting: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, category, price, available, dietary, preferredPhotoId
        case archivedAt, confirmedAt, revision, updatedAt, createdAt, sample
        case preserve, portion, plating, setting
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        category = (try? c.decode(String.self, forKey: .category)) ?? ""
        price = (try? c.decode(Int.self, forKey: .price)) ?? 0
        available = (try? c.decode(Int.self, forKey: .available)) ?? 1
        dietary = (try? c.decode([String].self, forKey: .dietary)) ?? []
        preferredPhotoId = try? c.decode(String.self, forKey: .preferredPhotoId)
        archivedAt = try? c.decode(Double.self, forKey: .archivedAt)
        confirmedAt = try? c.decode(Double.self, forKey: .confirmedAt)
        revision = (try? c.decode(Int.self, forKey: .revision)) ?? 1
        updatedAt = try? c.decode(Double.self, forKey: .updatedAt)
        createdAt = (try? c.decode(Double.self, forKey: .createdAt)) ?? 0
        sample = (try? c.decode(Int.self, forKey: .sample)) ?? 0
        preserve = (try? c.decode(String.self, forKey: .preserve)) ?? ""
        portion = (try? c.decode(String.self, forKey: .portion)) ?? ""
        plating = (try? c.decode(String.self, forKey: .plating)) ?? ""
        setting = (try? c.decode(String.self, forKey: .setting)) ?? "Natural daylight"
    }

    public var isAvailable: Bool { available != 0 }
    public var displayCategory: String { category.isEmpty ? "Dishes" : category }
}

public struct Asset: Decodable, Sendable, Equatable, Identifiable, Hashable {
    public let id: String
    public let dishId: String?
    /// "source" (uploaded), "generated", "edited", "logo", "reference" or "staff".
    public let kind: String
    public let mime: String?
    public let name: String?
    /// Set once the owner chose or used the photo.
    public var approvedAt: Double?
    public let needsCorrection: Int
    public let createdAt: Double
    public let lookId: String?

    enum CodingKeys: String, CodingKey {
        case id, dishId, kind, mime, name, approvedAt, needsCorrection, createdAt, lookId
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        dishId = try? c.decode(String.self, forKey: .dishId)
        kind = (try? c.decode(String.self, forKey: .kind)) ?? "source"
        mime = try? c.decode(String.self, forKey: .mime)
        name = try? c.decode(String.self, forKey: .name)
        approvedAt = try? c.decode(Double.self, forKey: .approvedAt)
        needsCorrection = (try? c.decode(Int.self, forKey: .needsCorrection)) ?? 0
        createdAt = (try? c.decode(Double.self, forKey: .createdAt)) ?? 0
        lookId = try? c.decode(String.self, forKey: .lookId)
    }

    public var isMadePhoto: Bool { kind == "generated" || kind == "edited" }
    public var isApproved: Bool { approvedAt != nil }
}

public struct Job: Decodable, Sendable, Equatable, Identifiable, Hashable {
    public let id: String
    public let dishId: String?
    /// queued, processing, completed, partial or failed.
    public let status: String
    public let sourceId: String?
    public let parentId: String?
    public let requestKey: String?
    public let createdAt: Double
    /// While queued or processing: how long images like this usually take.
    public let estimateMs: Double?
    /// The request's details, as JSON text.
    public let details: String?

    public var isActive: Bool { status == "queued" || status == "processing" }
}

public struct Output: Decodable, Sendable, Equatable, Identifiable, Hashable {
    public let id: String
    public let jobId: String
    public let slot: Int?
    /// queued, submitting, processing, uncertain, completed or failed.
    public let status: String
    public let assetId: String?
    public let error: String?
    public let submittedAt: Double?

    public var isFinished: Bool { status == "completed" || status == "failed" }
}

/// Decodes the elements it can and skips the ones it can't.
public struct LossyArray<Element: Decodable & Sendable>: Decodable, Sendable {
    public let elements: [Element]

    public init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var elements: [Element] = []
        while !container.isAtEnd {
            if let element = try? container.decode(Element.self) {
                elements.append(element)
            } else {
                _ = try? container.decode(Skip.self)
            }
        }
        self.elements = elements
    }

    /// Reads past any value.
    private struct Skip: Decodable {
        init(from decoder: any Decoder) throws {}
    }
}

// MARK: Dishes

/// `POST /api/dishes` (new) and `POST /api/dishes/<id>` (save). Saving
/// replaces every field, so the app always sends them all. The price here is
/// in major units (12.5), unlike everywhere else.
public struct DishSave: Codable, Sendable {
    public var creationId: String?
    public var revision: Int?
    public var name: String
    public var description: String
    public var category: String
    public var price: Double
    public var available: Bool
    public var confirmed = true
    public var dietary: [String]?
    public var preserve: String
    public var portion: String
    public var plating: String
    public var setting: String

    public init(dish: Dish) {
        revision = dish.revision
        name = dish.name
        description = dish.description
        category = dish.category
        price = Double(dish.price) / 100
        available = dish.isAvailable
        dietary = dish.dietary
        preserve = dish.preserve
        portion = dish.portion
        plating = dish.plating
        setting = dish.setting
    }

    /// A new dish with just a name, as the studio makes one for a photo.
    public init(newDishNamed name: String, id: String = UUID().uuidString.lowercased()) {
        creationId = id
        self.name = name
        description = ""
        category = "Dishes"
        price = 0
        available = true
        dietary = nil
        preserve = ""
        portion = ""
        plating = ""
        setting = "Natural daylight"
    }
}

public struct DishSaveResult: Decodable, Sendable {
    public struct Menu: Decodable, Sendable, Equatable, Hashable {
        public let id: String
        public let name: String
        public let live: Bool?
    }

    public let id: String
    public let revision: Int
    public let menus: [Menu]?
}

public struct LibraryUpdate: Encodable, Sendable {
    public var archived: Bool?
    public var preferredPhotoId: String?
    public init(archived: Bool? = nil, preferredPhotoId: String? = nil) {
        self.archived = archived
        self.preferredPhotoId = preferredPhotoId
    }
}

/// `POST /api/assets/<id>/use`: records how a photo is used; choosing it as a
/// dish's main photo, or downloading or sharing it, also approves it.
public struct PhotoUse: Encodable, Sendable {
    /// download, share, post, menu, pack or main.
    public let action: String
    public init(action: String) { self.action = action }
}

public struct UploadReply: Decodable, Sendable {
    public let id: String
}
