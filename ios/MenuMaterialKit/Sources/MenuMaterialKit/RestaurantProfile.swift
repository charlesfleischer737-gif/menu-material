import Foundation

/// Small, versioned restaurant preferences, shared between devices.
public struct RestaurantProfile: Codable, Sendable, Equatable {
    public var version = 1
    public var completed = false
    public var firstName = ""
    public var role = "Owner"
    public var goals: [String] = []
    public var firstAction = "photo"
    public var favoriteLooks: [String] = []
    public var recentLooks: [String] = []
    public var defaultLook = "keep"
    public init() {}
}
