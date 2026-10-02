// swift-tools-version: 6.0
import PackageDescription

// What the app knows about the Menu Material server: the API client, the
// models it decodes and small pure helpers. No UI, so `swift test` checks it
// quickly on its own.
let package = Package(
    name: "MenuMaterialKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "MenuMaterialKit", targets: ["MenuMaterialKit"]),
    ],
    targets: [
        .target(name: "MenuMaterialKit"),
        .testTarget(
            name: "MenuMaterialKitTests",
            dependencies: ["MenuMaterialKit"]
        ),
    ]
)
