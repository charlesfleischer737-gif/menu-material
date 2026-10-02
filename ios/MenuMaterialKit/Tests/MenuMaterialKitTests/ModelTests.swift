import Foundation
import Testing
@testable import MenuMaterialKit

/// The JSON shapes the server sends (docs/IOS_APP.md and the server code):
/// snake_case rows, SQLite flags as 0 or 1, millisecond timestamps.
struct ModelTests {
    static let state = #"""
    {
      "user": { "id": "u1", "email": "owner@example.com", "role": "owner" },
      "signIn": { "password": false, "google": false, "apple": true },
      "emailVerification": { "required": false, "email": "owner@example.com", "verifiedAt": null },
      "studioAvailability": { "revision": 0, "creationEnabled": true, "disabledStyleIds": ["bar-velvet"], "message": "" },
      "restaurant": { "id": "r1", "name": "Joe's Diner", "slug": "joes-diner", "currency": "USD",
        "menu_draft": "{}", "menuDraft": { "sections": [] }, "style": { "primary": "#202820" }, "public_suspended": 0 },
      "remaining": 4,
      "freeImages": null,
      "billing": { "plan": "free", "allowance": 5, "remaining": 4, "renewsAt": null, "enabled": false,
        "status": "free", "provider": null, "cancelAtPeriodEnd": false, "canManage": false,
        "features": { "pro": false, "source": "free", "proUntil": null, "limitsEnabled": true, "unlocked": false, "usage": { "liveMenus": 1 } } },
      "aiConnected": true, "imagesAvailable": true, "local": false,
      "menuOrigin": "https://menumaterial.com", "workerHealthy": true,
      "dishes": [
        { "id": "d1", "restaurant_id": "r1", "name": "Roast chicken", "description": "Leeks", "category": "Mains",
          "price": 2850, "available": 1, "dietary": ["gluten-free"], "preferred_photo_id": "a2", "archived_at": null,
          "confirmed_at": 1790000000000, "revision": 4, "updated_at": 0, "created_at": 1789990000000, "sample": 0,
          "preserve": "", "portion": "", "plating": "", "setting": "Natural daylight" },
        { "id": "d2", "name": "Sample salad", "price": 0, "available": 0, "sample": 1, "revision": 1, "created_at": 1 },
        { "name": "A row without an id" }
      ],
      "assets": [
        { "id": "a3", "dish_id": "d1", "kind": "generated", "mime": "image/jpeg", "name": "Studio photo", "approved_at": null,
          "needs_correction": 0, "created_at": 3, "from_photo": true, "photo_format": "menu", "look_id": "menu-stone" },
        { "id": "a2", "dish_id": "d1", "kind": "generated", "mime": "image/jpeg", "name": "Studio photo", "approved_at": 2,
          "needs_correction": 0, "created_at": 2, "from_photo": true, "photo_format": "menu", "look_id": "" },
        { "id": "a1", "dish_id": "d1", "kind": "source", "mime": "image/heic", "name": "photo.heic", "approved_at": null,
          "needs_correction": 0, "created_at": 1, "from_photo": false, "photo_format": "menu", "look_id": "" }
      ],
      "jobs": [
        { "id": "j2", "dish_id": "d1", "status": "processing", "source_id": "a1", "parent_id": null, "created_at": 100000,
          "estimate_ms": 45000, "details": "{\"controls\":{}}", "request_key": "k", "credit_period": "free" },
        { "id": "j1", "dish_id": "d1", "status": "completed", "source_id": "a1", "created_at": 50000 },
        { "id": "j0", "dish_id": "d1", "status": "failed", "source_id": "a1", "created_at": 10000 }
      ],
      "outputs": [
        { "id": "o2", "job_id": "j2", "slot": 0, "status": "processing", "asset_id": null, "error": null, "attempts": 1, "submitted_at": 107500 },
        { "id": "a2", "job_id": "j1", "slot": 0, "status": "completed", "asset_id": "a2", "error": null, "attempts": 1, "submitted_at": 50500 },
        { "id": "o0", "job_id": "j0", "slot": 0, "status": "failed", "asset_id": null, "error": "Image creation failed. This image was not counted.", "attempts": 1, "submitted_at": null }
      ],
      "promotions": [], "imports": [], "batchItems": [], "captions": [],
      "serverTime": 130000
    }
    """#

    func workspace() throws -> Workspace {
        try JSONCoding.decoder().decode(Workspace.self, from: Data(Self.state.utf8))
    }

    @Test func decodesTheWorkspace() throws {
        let workspace = try workspace()
        #expect(workspace.user?.email == "owner@example.com")
        #expect(workspace.signIn?.password == false)
        #expect(workspace.restaurant?.name == "Joe's Diner")
        #expect(workspace.billing?.features?.unlocked == false)
        #expect(workspace.studioAvailability?.disabledStyleIds == ["bar-velvet"])
        // The row without an id is skipped; the others stay.
        #expect(workspace.dishes.map(\.id) == ["d1", "d2"])
        #expect(workspace.dishes[0].price == 2850)
        #expect(workspace.dishes[0].isAvailable)
        #expect(!workspace.dishes[1].isAvailable)
        #expect(workspace.activeDishes.map(\.id) == ["d1"])
        #expect(workspace.jobs.first?.estimateMs == 45000)
    }

    @Test func picksTheDishPhotoAsTheWebDoes() throws {
        let workspace = try workspace()
        let dish = workspace.dishes[0]
        #expect(workspace.preferredPhoto(for: dish)?.id == "a2")
    }

    @Test func followsAPhotoToItsOutcome() throws {
        let workspace = try workspace()
        #expect(workspace.outcome(of: "j1", now: 130000) == .ready(assetId: "a2"))
        #expect(workspace.outcome(of: "j0", now: 130000) == .failed("Image creation failed. This image was not counted."))
        guard case .waiting(let progress, let hold) = workspace.outcome(of: "j2", now: 130000) else {
            Issue.record("Expected a photo in progress")
            return
        }
        // Sent 22.5 s ago of a usual 45 s.
        #expect(abs(progress.value - 0.475) < 0.0001)
        #expect(hold == nil)
        #expect(workspace.outcome(of: "nope", now: 0) == nil)
    }

    @Test func dishSavesSendEveryFieldInMajorUnits() throws {
        let dish = try workspace().dishes[0]
        var save = DishSave(dish: dish)
        save.available = false
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(save)) as! [String: Any]
        #expect(json["price"] as? Double == 28.5)
        #expect(json["available"] as? Bool == false)
        #expect(json["confirmed"] as? Bool == true)
        #expect(json["revision"] as? Int == 4)
        #expect(json["description"] as? String == "Leeks")
        #expect(json["setting"] as? String == "Natural daylight")
        #expect(json["creationId"] == nil)
        let fresh = DishSave(newDishNamed: "Fish tacos", id: "c0ffee00-0000-4000-8000-000000000000")
        let created = try JSONSerialization.jsonObject(with: JSONEncoder().encode(fresh)) as! [String: Any]
        #expect(created["creationId"] as? String == "c0ffee00-0000-4000-8000-000000000000")
        #expect(created["revision"] == nil)
        #expect(created["dietary"] == nil)
    }

    @Test func buildsThePhotoRequestTheWebSends() throws {
        let catalog = try JSONCoding.decoder().decode(StyleCatalog.self, from: Data(#"""
        { "categories": [ { "id": "menu", "name": "Menu & Website", "description": "", "use": "" } ],
          "polish": { "id": "keep", "name": "Polish my original", "cue": "Your scene", "category": null, "description": null,
            "bestFor": null, "traits": [], "pro": false, "plate": "keep", "image": "/studio/styles/delivery-white.webp",
            "thumbnail": "/studio/styles/thumbs/delivery-white.webp",
            "photoStyle": "Retain the original setting and all surroundings. Improve natural lighting, neutral color and clarity.",
            "photoPreset": "" },
          "styles": [ { "id": "menu-stone", "name": "Stone", "cue": "Pale limestone", "category": "menu", "description": "d",
            "bestFor": "Mains", "traits": ["Daylight"], "pro": false, "plate": "style", "image": "/studio/styles/menu-stone.webp",
            "thumbnail": "/studio/styles/thumbs/menu-stone.webp", "photoStyle": "Pale limestone tabletop.", "photoPreset": "menu-stone" } ] }
        """#.utf8))
        #expect(catalog.look(id: "keep")?.name == "Polish my original")
        #expect(catalog.looks(in: catalog.categories[0]).map(\.id) == ["menu-stone"])
        let request = PhotoRequest(
            look: catalog.look(id: "menu-stone")!, format: .feed, note: "  More room above  ",
            dishId: "d1", sourceId: "a1", requestKey: "c0ffee00-1234-4abc-8def-0123456789ab"
        )
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as! [String: Any]
        #expect(json["requestKey"] as? String == "c0ffee00-1234-4abc-8def-0123456789ab")
        #expect(json["revision"] as? String == "More room above")
        #expect(json["candidateCount"] as? Int == 1)
        #expect(json["editMode"] as? String == "preserve")
        let style = json["style"] as! [String: Any]
        #expect(style["photoPreset"] as? String == "menu-stone")
        #expect(style["photoStyle"] as? String == "Pale limestone tabletop.")
        #expect((style["referenceIds"] as? [String])?.isEmpty == true)
        let look = json["lookContext"] as! [String: Any]
        #expect(look["presetId"] as? String == "menu-stone")
        #expect(look["occasionId"] as? String == "")
        let controls = json["controls"] as! [String: Any]
        #expect(controls["format"] as? String == "feed")
        #expect(controls["plate"] as? String == "style")
        #expect(controls["angle"] as? String == "keep")
        #expect(controls["surface"] as? String == "As shown")
        #expect(controls["cropX"] as? Int == 50)
        #expect(controls["zoom"] as? Int == 1)
    }

    @Test func readsMenusOldAndNew() throws {
        let list = try JSONCoding.decoder().decode(MenuList.self, from: Data(#"""
        { "menus": [
          { "id": "m1", "draft": { "name": "Dinner menu", "sections": [ { "id": "s1", "name": "Mains", "items": [ { "id": "e1" } ] } ] },
            "revision": 12, "published": { "title": "Dinner", "showUnavailable": true,
              "restaurant": { "name": "Joe's", "currency": "EUR" },
              "sections": [ { "id": "s1", "name": "Mains", "items": [
                { "id": "e1", "dishId": "d1", "name": "Roast chicken", "price": 2850, "priceMode": "single", "available": false },
                { "id": "e2", "name": "Latte", "priceMode": "variants", "variants": [ { "id": "s", "label": "Small", "price": 500 } ] } ] } ] },
            "publishedRevision": 12, "publishedAt": 1, "isPrimary": true, "updatedAt": 2, "archivedAt": null },
          { "id": "m2", "draft": { "name": "Old menu" }, "revision": 3,
            "published": { "sections": [ { "name": "Starters", "items": [ { "id": "x", "name": "Soup", "price": 800 } ] } ] },
            "isPrimary": false },
          { "draft": { "name": "Broken: no id" }, "revision": 1 }
        ] }
        """#.utf8))
        #expect(list.menus.map(\.id) == ["m1", "m2"])
        let dinner = list.menus[0]
        #expect(dinner.isLive && dinner.isUpToDate)
        #expect(dinner.published?.currency == "EUR")
        #expect(dinner.published?.entries.first?.available == false)
        #expect(dinner.published?.entries.last?.variants.first?.price == 500)
        // A menu published before Menus existed: defaults fill the gaps.
        let old = list.menus[1].published?.entries.first
        #expect(old?.priceMode == "single")
        #expect(old?.available == true)
        #expect(list.menus[1].published?.sections.first?.id == "Starters")
    }

    @Test func quickUpdatesLeaveOutWhatDidntChange() throws {
        let update = QuickUpdate(revision: 12, changes: [QuickUpdate.Change(entryId: "e1", available: true)])
        let json = String(decoding: try JSONEncoder().encode(update), as: UTF8.self)
        #expect(json.contains(#""entryId":"e1""#))
        #expect(json.contains(#""available":true"#))
        #expect(!json.contains("price"))
        #expect(!json.contains("null"))
    }

    @Test func guestLinksMatchTheWeb() throws {
        let list = try JSONCoding.decoder().decode(MenuList.self, from: Data(#"""
        { "menus": [ { "id": "m1", "draft": {}, "revision": 1, "isPrimary": true },
                     { "id": "m2", "draft": {}, "revision": 1, "isPrimary": false } ] }
        """#.utf8))
        let main = MenuLinks.guestURL(origin: "https://menumaterial.com", slug: "joes-diner", menu: list.menus[0], placement: .table)
        #expect(main?.absoluteString == "https://menumaterial.com/m/joes-diner?src=table")
        let other = MenuLinks.guestURL(origin: "https://menumaterial.com", slug: "joes-diner", menu: list.menus[1], placement: .instagram)
        #expect(other?.absoluteString == "https://menumaterial.com/m/joes-diner?menu=m2&src=instagram")
    }

    @Test func readsNativeConfigAndAuthReplies() throws {
        let config = try JSONCoding.decoder().decode(NativeConfig.self, from: Data(#"""
        { "minimumVersion": null, "signIn": { "apple": true, "google": null },
          "billing": { "appStore": true, "productId": "com.menumaterial.app.pro.monthly", "priceLabel": "$9", "imagesPerPeriod": 50 },
          "links": { "support": "mailto:help@example.com", "terms": null, "privacy": "https://menumaterial.com/privacy" } }
        """#.utf8))
        #expect(config.signIn.apple)
        #expect(config.billing.imagesPerPeriod == 50)
        let tokens = try JSONCoding.decoder().decode(AuthReply.self, from: Data(#"{"ok":true,"token":"t","deviceToken":"d"}"#.utf8))
        #expect(tokens.signedIn)
        let step = try JSONCoding.decoder().decode(AuthReply.self, from: Data(#"{"step":"signup","email":"a@b.c"}"#.utf8))
        #expect(!step.signedIn && step.step == "signup")
        let google = try JSONDecoder().decode(GoogleTokenReply.self, from: Data(#"{"id_token":"abc","access_token":"x"}"#.utf8))
        #expect(google.idToken == "abc")
    }
}
