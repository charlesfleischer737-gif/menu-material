import Foundation

/// A menu, as `/api/menus` lists it. `published` is what guests see; nil
/// means the menu isn't live.
public struct MenuRecord: Decodable, Sendable, Equatable, Identifiable {
    public let id: String
    public let draft: MenuDraft
    public let revision: Int
    public let published: LiveMenu?
    public let publishedRevision: Int?
    public let publishedAt: Double?
    public let isPrimary: Bool
    public let updatedAt: Double?
    /// On quick updates: other menus the change also reached.
    public let menus: [DishSaveResult.Menu]?

    enum CodingKeys: String, CodingKey {
        case id, draft, revision, published, publishedRevision, publishedAt, isPrimary, updatedAt, menus
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        draft = (try? c.decode(MenuDraft.self, forKey: .draft)) ?? MenuDraft(name: "Menu")
        revision = try c.decode(Int.self, forKey: .revision)
        published = try? c.decodeIfPresent(LiveMenu.self, forKey: .published)
        publishedRevision = try? c.decodeIfPresent(Int.self, forKey: .publishedRevision)
        publishedAt = try? c.decodeIfPresent(Double.self, forKey: .publishedAt)
        isPrimary = (try? c.decode(Bool.self, forKey: .isPrimary)) ?? false
        updatedAt = try? c.decodeIfPresent(Double.self, forKey: .updatedAt)
        menus = try? c.decodeIfPresent([DishSaveResult.Menu].self, forKey: .menus)
    }

    public var isLive: Bool { published != nil }
    /// The live copy shows the latest draft.
    public var isUpToDate: Bool { isLive && publishedRevision == revision }
    public var name: String { draft.name.isEmpty ? (published?.title ?? "Menu") : draft.name }
}

public struct MenuDraft: Decodable, Sendable, Equatable {
    public let name: String
    public let sections: [MenuSection]

    init(name: String) {
        self.name = name
        sections = []
    }

    enum CodingKeys: String, CodingKey { case name, sections }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        sections = (try? c.decode(LossyArray<MenuSection>.self, forKey: .sections))?.elements ?? []
    }

    public var dishCount: Int { sections.reduce(0) { $0 + $1.items.count } }
}

/// A menu's live copy. Menus published before Menus existed keep their old
/// shape, so every field is optional.
public struct LiveMenu: Decodable, Sendable, Equatable {
    public let title: String?
    public let sections: [MenuSection]
    public let showUnavailable: Bool
    public let currency: String?

    enum CodingKeys: String, CodingKey { case title, sections, showUnavailable, restaurant }
    enum RestaurantKeys: String, CodingKey { case currency }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try? c.decode(String.self, forKey: .title)
        sections = (try? c.decode(LossyArray<MenuSection>.self, forKey: .sections))?.elements ?? []
        showUnavailable = (try? c.decode(Bool.self, forKey: .showUnavailable)) ?? true
        currency = try? c.nestedContainer(keyedBy: RestaurantKeys.self, forKey: .restaurant)
            .decode(String.self, forKey: .currency)
    }

    public var entries: [MenuEntry] { sections.flatMap(\.items) }
}

public struct MenuSection: Decodable, Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let items: [MenuEntry]

    enum CodingKeys: String, CodingKey { case id, name, items }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        id = (try? c.decode(String.self, forKey: .id)) ?? name
        items = (try? c.decode(LossyArray<MenuEntry>.self, forKey: .items))?.elements ?? []
    }
}

public struct MenuEntry: Decodable, Sendable, Equatable, Identifiable {
    public struct Variant: Codable, Sendable, Equatable, Identifiable {
        public let id: String
        public let label: String?
        /// Hundredths.
        public var price: Int
    }

    /// The entry's ID, which quick updates name (not the dish's).
    public let id: String
    public let dishId: String?
    public let name: String
    /// Hundredths, or nil.
    public var price: Int?
    /// single, variants, label or included.
    public let priceMode: String
    public var variants: [Variant]
    public var available: Bool
    public let photoId: String?

    enum CodingKeys: String, CodingKey { case id, dishId, name, price, priceMode, variants, available, photoId }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        dishId = try? c.decode(String.self, forKey: .dishId)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        price = try? c.decode(Int.self, forKey: .price)
        priceMode = (try? c.decode(String.self, forKey: .priceMode)) ?? "single"
        variants = (try? c.decode(LossyArray<Variant>.self, forKey: .variants))?.elements ?? []
        available = (try? c.decode(Bool.self, forKey: .available)) ?? true
        photoId = try? c.decode(String.self, forKey: .photoId)
    }
}

public struct MenuList: Decodable, Sendable {
    public let menus: [MenuRecord]

    enum CodingKeys: String, CodingKey { case menus }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        menus = (try? c.decode(LossyArray<MenuRecord>.self, forKey: .menus))?.elements ?? []
    }
}

/// `POST /api/menus/<id>/live`: sold out, back on, and prices, live at once.
public struct QuickUpdate: Encodable, Sendable {
    public struct Change: Encodable, Sendable, Equatable {
        public let entryId: String
        public var available: Bool?
        /// Hundredths, at least 1; single-price entries only.
        public var price: Int?
        /// Every variant, when any changed.
        public var variants: [VariantPrice]?

        public init(entryId: String, available: Bool? = nil, price: Int? = nil, variants: [VariantPrice]? = nil) {
            self.entryId = entryId
            self.available = available
            self.price = price
            self.variants = variants
        }
    }

    public struct VariantPrice: Encodable, Sendable, Equatable {
        public let id: String
        public let price: Int
        public init(id: String, price: Int) {
            self.id = id
            self.price = price
        }
    }

    public let revision: Int
    public let changes: [Change]

    public init(revision: Int, changes: [Change]) {
        self.revision = revision
        self.changes = changes
    }
}

public struct RevisionRequest: Encodable, Sendable {
    public let revision: Int
    public let confirmed = true
    public init(revision: Int) { self.revision = revision }
}

/// Where a guest link is used, for the menu's visit counts.
public enum MenuPlacement: String, CaseIterable, Sendable, Identifiable {
    case table, counter, window, takeout, flyer, instagram, website, google

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .table: "Table card"
        case .counter: "Counter"
        case .window: "Window"
        case .takeout: "Takeout bag"
        case .flyer: "Flyer"
        case .instagram: "Instagram bio"
        case .website: "Website"
        case .google: "Google profile"
        }
    }

    /// Printed places get a QR code; the others a link to paste.
    public var printed: Bool {
        [.table, .counter, .window, .takeout, .flyer].contains(self)
    }
}

public enum MenuLinks {
    /// `{menuOrigin}/m/{slug}[?menu={id}]&src={placement}`, as the web
    /// builds it. The main menu leaves out `menu`.
    public static func guestURL(origin: String, slug: String, menu: MenuRecord, placement: MenuPlacement) -> URL? {
        var components = URLComponents(string: origin)
        components?.path = "/m/\(slug)"
        var items: [URLQueryItem] = []
        if !menu.isPrimary { items.append(URLQueryItem(name: "menu", value: menu.id)) }
        items.append(URLQueryItem(name: "src", value: placement.rawValue))
        components?.queryItems = items
        return components?.url
    }
}
