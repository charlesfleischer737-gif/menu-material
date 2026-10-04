import Foundation
import MenuMaterialKit
import Testing
import UIKit
import SwiftUI
@testable import MenuMaterial

/// The server accepts a render but its first response disappears. A retry must
/// reconcile the receipt, even after the view/model has been destroyed.
actor LostResponseTransport: HTTPTransport {
    var requests: [URLRequest] = []
    var accepted: String?
    var acceptThenDisconnect = true
    var dropUploadReceipt: Bool
    let fixture: URL
    init(fixture: URL, failUpload: Bool = false) { self.fixture = fixture; self.dropUploadReceipt = failUpload }
    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        let path = request.url!.path
        var data = Data("{}".utf8)
        if path.hasSuffix("/native/styles") { data = try Data(contentsOf: fixture.appending(path: "api/native/styles.json")) }
        else if path.hasSuffix("/state") {
            var state = try JSONSerialization.jsonObject(with: DemoTransport.resolveTimes(Data(contentsOf: fixture.appending(path: "api/state.json")))) as! [String: Any]
            if let accepted {
                state["jobs"] = [["id":"accepted-job", "dish_id":"dish-burger", "source_id":"source-burger", "status":"completed", "created_at":Date().timeIntervalSince1970 * 1000, "request_key":accepted]]
                state["outputs"] = [["id":"accepted-output", "job_id":"accepted-job", "status":"completed", "asset_id":"accepted-asset"]]
            }
            data = try JSONSerialization.data(withJSONObject: state)
        } else if path.hasSuffix("/jobs") {
            let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
            accepted = body["requestKey"] as? String
            if acceptThenDisconnect { acceptThenDisconnect = false; throw URLError(.networkConnectionLost) }
            data = Data(#"{"id":"accepted-job","status":"completed"}"#.utf8)
        } else if path.hasSuffix("/dishes") { data = Data(#"{"id":"created-dish","revision":1}"#.utf8) }
        else if path.hasSuffix("/assets") {
            if dropUploadReceipt { dropUploadReceipt = false; throw URLError(.networkConnectionLost) }
            data = Data(#"{"id":"uploaded-source"}"#.utf8)
        }
        else { data = Data(#"{"ok":true}"#.utf8) }
        return (data, HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
    }
    func jobRequests() -> [URLRequest] { requests.filter { $0.url?.path.hasSuffix("/jobs") == true } }
    func uploadRequests() -> [URLRequest] { requests.filter { $0.url?.path.hasSuffix("/assets") == true } }
    func creationRequests() -> [URLRequest] { requests.filter { $0.url?.path.hasSuffix("/dishes") == true } }
}

@MainActor struct RecoveryTests {
    private func photo() async throws -> PreparedPhoto {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 80)).image { ctx in UIColor.orange.setFill(); ctx.fill(CGRect(x:0,y:0,width:100,height:80)) }
        return try await PreparedPhoto.fromCamera(image)
    }
    @Test func restoresDraftAndSeparatesAccounts() async throws {
        let local = LocalWorkspace(); local.configure(session: UUID().uuidString)
        defer { local.clear() }
        let first = StudioModel(); first.configure(local)
        first.choose(try await photo()); first.dishName = "Roasted carrots"; first.note = "Keep the garnish"; first.lookId = "studio-dark"; first.format = .feed
        let second = StudioModel(); second.configure(local)
        #expect(second.stage == .composing)
        #expect(second.dishName == "Roasted carrots")
        #expect(second.note == "Keep the garnish")
        #expect(second.photo?.original == first.photo?.original)
        #expect(second.format == .feed)
        let other = LocalWorkspace(); other.configure(session: UUID().uuidString); defer { other.clear() }
        let third = StudioModel(); third.configure(other)
        #expect(third.stage == .empty); #expect(third.photo == nil)
        local.clear(); #expect(local.data("studio.json") == nil)
    }
    @Test func lostRenderReceiptIsReconciledAfterRelaunch() async throws {
        let root = try #require(Demo.root)
        let transport = LostResponseTransport(fixture: root)
        let client = APIClient(server: URL(string:"https://fixture.test")!,appVersion:"1.0",transport:transport)
        client.sessionToken = UUID().uuidString
        let model = AppModel(clientOverride: client)
        defer { model.local.clear(); model.studio.stopWatching() }
        #expect(await model.refresh())
        let studio = model.studio
        await studio.loadCatalog(client)
        studio.choose(try await photo()); studio.dishName = "A new dish"
        await studio.create(model:model)
        #expect(studio.stage == .composing)
        #expect(studio.hasUncertainRequest)
        let restored = StudioModel(); restored.configure(model.local)
        await restored.loadCatalog(client)
        #expect(restored.hasUncertainRequest)
        await restored.create(model:model)
        #expect(restored.stage == .result(jobId:"accepted-job",assetId:"accepted-asset"))
        #expect(await transport.jobRequests().count == 1)
        #expect(await transport.creationRequests().count == 1)
    }
    @Test func interruptedUploadKeepsItsIdentityAndDishAfterRelaunch() async throws {
        let transport = LostResponseTransport(fixture: try #require(Demo.root), failUpload: true)
        let client = APIClient(server: URL(string:"https://fixture.test")!, appVersion:"1.0", transport:transport)
        client.sessionToken = UUID().uuidString
        let model = AppModel(clientOverride:client)
        defer { model.local.clear(); model.studio.stopWatching() }
        #expect(await model.refresh())
        await model.studio.loadCatalog(client)
        model.studio.choose(try await photo()); model.studio.dishName = "Soup"
        await model.studio.create(model:model)
        #expect(model.studio.stage == .composing)
        let restored = StudioModel(); restored.configure(model.local)
        await restored.loadCatalog(client); await restored.create(model:model)
        let uploads = await transport.uploadRequests()
        #expect(uploads.count == 2)
        func key(_ request: URLRequest) -> String? {
            let body = String(decoding: request.httpBody ?? Data(), as: UTF8.self)
            return body.components(separatedBy: "name=\"requestKey\"\r\n\r\n").last?.components(separatedBy:"\r\n").first
        }
        #expect(key(uploads[0]) == key(uploads[1]))
        #expect(await transport.creationRequests().count == 1)
    }
    @Test func invalidPricesNeverBecomePositiveAmounts() {
        for text in ["-12", "+12", "1e3", "12abc", "1.234", "1,200.00", "NaN", "9 9"] { #expect(Money.hundredths(from:text) == nil) }
        #expect(Money.hundredths(from:"12,50") == 1250)
        #expect(Money.hundredths(from:" $9 ") == 900)
    }
    @Test func postExportsUseExactFeedAndStoryDimensions() throws {
        var draft = PostDraft(); draft.headline = "A long, delicious dish name"; draft.detail = "A description that stays below the photo."; draft.price = "$12"
        for (format,height) in [("Feed",1350),("Story",1920)] {
            draft.format = format
            let renderer = ImageRenderer(content: PostArtwork(draft:draft,image:nil,restaurant:"Olive & Ember").frame(width:1080,height:CGFloat(height)))
            renderer.scale = 1
            let image = try #require(renderer.uiImage)
            #expect(image.size.width == 1080); #expect(image.size.height == CGFloat(height))
        }
    }
}
