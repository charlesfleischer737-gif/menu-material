# Menu Material for iPhone

The native SwiftUI app (iOS 26 or later, iPhone). It talks to the same API as menumaterial.com; see [docs/IOS_APP.md](../docs/IOS_APP.md) for the plan, the server side and the App Store Connect setup.

## Build and run

You need a Mac with Xcode 26 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`). The Xcode project is generated from `project.yml` and isn't checked in.

```sh
cd ios
xcodegen generate
open MenuMaterial.xcodeproj
```

Choose the **MenuMaterial** scheme and an iPhone simulator, then Run. To run on a phone, set your team under Signing & Capabilities (or `DEVELOPMENT_TEAM` in `project.yml`).

The app talks to `https://menumaterial.com` by default. To use a local server, change `MENU_MATERIAL_SERVER` in `project.yml` (or in the target's build settings) to your Mac's address, for example `http://192.168.1.20:5173`. A plain-HTTP address also needs an App Transport Security exception for development.

Run `xcodegen generate` again after adding or removing files or changing `project.yml`.

### The sample restaurant

The **MenuMaterial Demo** scheme runs the app as Olive & Ember, a sample restaurant served from `DemoFixtures/` instead of the server, so you can try every screen without an account or a network. It's set by `MENU_MATERIAL_DEMO=1`; `MENU_MATERIAL_DEMO_SCENE` starts on a particular screen (`welcome`, or the Studio's `compose`, `creating` or `result`), and `MENU_MATERIAL_DEMO_DARK=1` forces dark mode. See `MenuMaterial/App/Demo.swift`. Debug builds only: Release builds leave the fixtures and the code out.

## Tests

```sh
cd ios/MenuMaterialKit && swift test          # API client, models, progress, money
cd ios && xcodebuild test -project MenuMaterial.xcodeproj -scheme MenuMaterial \
  -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO
```

The **iOS** GitHub Actions workflow (`.github/workflows/ios.yml`) runs both on every pull request that changes `ios/`.

`MenuMaterialUITests` opens every screen of the sample restaurant in light and dark and keeps a screenshot of each. The workflow publishes them to the [`ios-screenshots`](https://github.com/charlesfleischer737-gif/menu-material/tree/ios-screenshots) branch, whose README shows them side by side, so a change to the app can be reviewed without a Mac. They're also a starting point for the App Store screenshots.

## How it's organized

- `MenuMaterialKit/`: a Swift package with no UI: the API client (`X-Menu-Material-Client: ios`, the version header and the Bearer session), the models it decodes and pure helpers such as the progress bar's formula. Tested with `swift test`.
- `MenuMaterial/App`: app state (`AppModel`), StoreKit (`StoreModel`), private photo loading (`ImagePipeline`), push registration (`AppDelegate`).
- `MenuMaterial/Design`: the look of the app. Surfaces and text use Apple's system colors, so light, dark and Increase Contrast match the rest of iOS, with evergreen as the one brand color; headlines are in New York, Apple's serif. Actions are Liquid Glass buttons (`primaryAction()`, `secondaryAction()`), and the shared components include the before-and-after slider, the glow around a photo being made, glass toasts and Settings-style rows.
- `MenuMaterial/Features`: Onboarding (Sign in with Apple, Google, email), Studio, Dishes, Menus, Plans and Account.
- `PhotoActivity/`: the Live Activity shown while a photo is made; the server ends it with a push.
- `Shared/`: code compiled into both the app and the extension.

## Releasing

1. In App Store Connect, finish the setup in [docs/IOS_APP.md](../docs/IOS_APP.md#setting-it-up): the app record, the Pro subscription, the keys and the server settings.
2. Set `DEVELOPMENT_TEAM`, raise `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.yml`, and generate the project.
3. In Xcode, Product → Archive, then Distribute App → App Store Connect. TestFlight builds use production push notifications and the App Store sandbox.
4. When a release needs a newer app for a server change, set `IOS_MIN_VERSION` on the server once the new version is live.

## Workflow update

See [the implementation and release checklist](../docs/IOS_IMPROVEMENTS.md). The app and PhotoShare extension both require the `group.com.menumaterial.app` App Group when signing. Regenerate the project after pulling this update.
