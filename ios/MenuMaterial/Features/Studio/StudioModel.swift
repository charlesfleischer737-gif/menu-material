import Foundation
import MenuMaterialKit
import Observation
import UIKit

/// One photo's way through the Studio: chosen, styled, made, kept. It
/// follows the web's sequence (docs/IOS_APP.md): a confirmed dish, the
/// upload, the image request, then the job's progress until its photo
/// arrives. The phone never makes the image itself; the server does.
@Observable
final class StudioModel {
    enum Stage: Equatable, Codable {
        case empty
        case composing
        case submitting
        case creating(jobId: String)
        case result(jobId: String, assetId: String)
        case failed(jobId: String, message: String)
    }

    var stage: Stage = .empty { didSet { persist() } }
    private(set) var catalog: StyleCatalog?
    var lookId = "keep" { didSet { persist() } }
    var format: PhotoFormat = .menu { didSet { persist() } }
    var note = "" { didSet { persist() } }
    var dishName = "" { didSet { persist() } }
    var error: String?
    var catalogError: String?
    var recovering = false
    private weak var local: LocalWorkspace?
    private var restoring = false
    private var pendingRequest: Data?
    private var creationId = UUID().uuidString.lowercased()
    private var creationSave: DishSave?
    private var requestKey: String?
    var hasUncertainRequest: Bool { pendingRequest != nil }

    private struct Draft: Codable {
        var stage: Stage
        var lookId: String
        var format: PhotoFormat
        var note: String
        var dishName: String
        var sourceId: String?
        var dishId: String?
        var uploadKey: String?
        var creationId: String
        var creationSave: DishSave?
        var pendingRequest: Data?
        var requestKey: String?
        var originalName: String?
        var originalType: String?
    }

    func configure(_ store: LocalWorkspace) {
        stopWatching(); ticking?.cancel(); ticking = nil
        restoring = true
        local = store
        if let saved: Draft = store.read("studio.json") {
            stage = saved.stage == .submitting ? .composing : saved.stage
            lookId = saved.lookId; format = saved.format; note = saved.note; dishName = saved.dishName
            sourceId = saved.sourceId; dishId = saved.dishId; uploadKey = saved.uploadKey
            creationId = saved.creationId; creationSave = saved.creationSave
            pendingRequest = saved.pendingRequest; requestKey = saved.requestKey
            if saved.originalName != nil, let original = store.data("studio-original"), let working = store.data("studio-working"),
               let preview = UIImage(data: working) {
                photo = PreparedPhoto(original: original, originalName: saved.originalName ?? "photo.jpg",
                    originalType: saved.originalType ?? "image/jpeg", working: working, preview: preview)
            }
        } else { startOver() }
        restoring = false
    }

    func persist() {
        guard !restoring, let local else { return }
        let draft = Draft(stage: stage, lookId: lookId, format: format, note: note, dishName: dishName,
            sourceId: sourceId, dishId: dishId, uploadKey: uploadKey, creationId: creationId,
            creationSave: creationSave, pendingRequest: pendingRequest, requestKey: requestKey,
            originalName: photo?.originalName, originalType: photo?.originalType)
        if !local.save(draft, "studio.json") { error = local.failure }
    }

    func resetAccount() {
        local = nil; catalog = nil; catalogError = nil; startOver()
    }

    func select(dish: Dish, workspace: Workspace?, newPhoto: Bool) {
        startOver()
        dishId = dish.id; dishName = dish.name
        if !newPhoto {
            sourceId = workspace?.photos(for: dish.id).first(where: { $0.kind == "source" })?.id
                ?? workspace?.preferredPhoto(for: dish)?.id
        }
        if sourceId != nil { stage = .composing }
        persist()
    }
    var preparing = false
    /// The photo picked on this phone, until it is uploaded and after.
    private(set) var photo: PreparedPhoto?
    /// The uploaded original, and its dish: kept so another look can be
    /// tried without uploading again.
    private(set) var sourceId: String?
    private(set) var dishId: String?
    private var uploadKey: String?
    private var watcher: Task<Void, Never>?
    private var ticking: Task<Void, Never>?
    /// Something the screen should open: Plans, or email verification.
    var needsPlans = false
    var needsVerification = false
    /// The look of the photo being made, when it was chosen here.
    private(set) var makingLook: String?

    var look: StyleCatalog.Look? { catalog?.look(id: lookId) }

    func loadCatalog(_ client: APIClient) async {
        guard catalog == nil else { return }
        catalogError = nil
        if let cached: StyleCatalog = local?.read("styles.json") { catalog = cached }
        do {
            catalog = try await client.get("native/styles")
            if let catalog { local?.save(catalog, "styles.json") }
        } catch { catalogError = error.localizedDescription }
    }

    // MARK: Choosing a photo

    func choose(_ prepared: PreparedPhoto) {
        guard stage != .submitting else { return }
        photo = prepared
        sourceId = nil
        uploadKey = nil
        pendingRequest = nil; requestKey = nil
        local?.save(prepared.original, "studio-original")
        local?.save(prepared.working, "studio-working")
        error = nil
        stage = .composing
    }

    func startOver() {
        watcher?.cancel(); ticking?.cancel(); ticking = nil
        pendingRequest = nil; requestKey = nil; creationSave = nil
        creationId = UUID().uuidString.lowercased()
        local?.remove("studio-original"); local?.remove("studio-working")
        photo = nil
        sourceId = nil
        dishId = nil
        uploadKey = nil
        note = ""
        dishName = ""
        error = nil
        stage = .empty
    }

    /// Back to the looks, keeping the uploaded photo.
    func tryAnotherLook() {
        pendingRequest = nil; requestKey = nil
        error = nil
        stage = .composing
    }

    /// Opens an earlier photo: its result, or its progress.
    func open(jobId: String, model: AppModel) {
        guard let workspace = model.workspace,
              let job = workspace.jobs.first(where: { $0.id == jobId }) else { return }
        sourceId = job.sourceId
        dishId = job.dishId
        photo = nil
        makingLook = nil
        pendingRequest = nil; requestKey = nil
        dishName = workspace.dishes.first { $0.id == job.dishId }?.name ?? ""
        if let details = job.details?.data(using: .utf8),
           let json = (try? JSONSerialization.jsonObject(with: details)) as? [String: Any] {
            lookId = (json["lookContext"] as? [String: Any])?["presetId"] as? String ?? "keep"
            note = json["revision"] as? String ?? ""
            format = PhotoFormat(rawValue: (json["controls"] as? [String: Any])?["format"] as? String ?? "menu") ?? .menu
        }
        switch workspace.outcome(of: jobId, now: model.serverNow) {
        case .ready(let assetId):
            stage = .result(jobId: jobId, assetId: assetId)
        case .failed(let message):
            stage = .failed(jobId: jobId, message: message)
        case .waiting:
            stage = .creating(jobId: jobId)
            watch(jobId: jobId, model: model)
        case nil:
            break
        }
    }

    /// On launch: carry on with a photo that was still being made.
    func resume(_ model: AppModel) {
        if case .creating(let id) = stage { watch(jobId: id, model: model); return }
        if let requestKey, let existing = model.workspace?.jobs.first(where: { $0.requestKey == requestKey }) {
            open(jobId: existing.id, model: model); return
        }
        guard stage == .empty, let workspace = model.workspace else { return }
        let recent = workspace.jobs.first {
            $0.isActive && model.serverNow - $0.createdAt < 30 * 60 * 1000
        }
        if let recent { open(jobId: recent.id, model: model) }
    }

    // MARK: Making the photo

    func create(model: AppModel) async {
        guard stage != .submitting, let look, sourceId != nil || photo != nil else { return }
        guard !model.isOffline else { error = "Reconnect to create your photo. Your draft is saved."; return }
        guard !dishName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || dishId != nil else {
            error = "Name this dish so you can find it again."; return
        }
        error = nil
        stage = .submitting
        let client = model.client
        let attemptId = creationId
        let session = client.sessionToken
        do {
            // Reconcile a lost response before sending the exact same request.
            if let requestKey {
                guard await model.refresh() else { throw APIError.offlineError }
                if let found = model.workspace?.jobs.first(where: { $0.requestKey == requestKey }) {
                    model.recordMetric("recovery", since: Date())
                    open(jobId: found.id, model: model); return
                }
            }
            if dishId == nil {
                let name = dishName.trimmingCharacters(in: .whitespacesAndNewlines)
                var save = creationSave ?? DishSave(newDishNamed: String(name.prefix(100)), id: creationId)
                save.setting = String(look.photoStyle.prefix(300))
                creationSave = save; persist()
                let reply: DishSaveResult = try await client.post("dishes", save)
                guard creationId == attemptId, client.sessionToken == session else { return }
                dishId = reply.id
                persist()
            }
            if sourceId == nil, let photo, let dishId {
                let key = uploadKey ?? UUID().uuidString.lowercased()
                uploadKey = key; persist()
                let began = Date()
                let reply: UploadReply = try await client.upload(
                    "assets",
                    form: .dishPhoto(photo, dishId: dishId, requestKey: key)
                )
                guard creationId == attemptId, client.sessionToken == session else { return }
                model.recordMetric("upload", since: began)
                sourceId = reply.id; persist()
                if let image = UIImage(data: photo.working) {
                    model.images.remember(image, asset: reply.id)
                }
            }
            guard let dishId, let sourceId else { return }
            if pendingRequest == nil {
                let key = UUID().uuidString.lowercased()
                pendingRequest = try JSONEncoder().encode(PhotoRequest(look: look, format: format, note: note,
                    dishId: dishId, sourceId: sourceId, requestKey: key))
                requestKey = key; persist()
            }
            let job = try APIClient.decode(JobReply.self, from: await client.send(client.request(.post, "jobs", body: pendingRequest)))
            guard creationId == attemptId, client.sessionToken == session else { return }
            pendingRequest = nil; requestKey = nil
            var profile = model.profile
            profile.recentLooks = Array(([lookId] + profile.recentLooks.filter { $0 != lookId }).prefix(8))
            // Preferences never block an accepted render.
            try? await model.saveProfile(profile)
            await model.refresh()
            if case .ready(let assetId) = model.workspace?.outcome(of: job.id, now: model.serverNow) {
                // The same photo in the same look was made before: no image used.
                stage = .result(jobId: job.id, assetId: assetId)
                return
            }
            makingLook = look.name
            stage = .creating(jobId: job.id)
            let typical = model.workspace?.jobs.first { $0.id == job.id }?.estimateMs ?? 45000
            PhotoActivities.start(
                jobId: job.id,
                dishName: dishName.isEmpty ? "Your dish" : dishName,
                lookName: look.name,
                expectedSeconds: typical / 1000,
                client: client
            )
            watch(jobId: job.id, model: model)
            await model.askForNotifications()
        } catch let failure as APIError {
            guard creationId == attemptId, client.sessionToken == session else { return }
            // A definite validation rejection permits editing. Ambiguous network
            // or server failures retain the body and its idempotency key.
            if (400..<500).contains(failure.status), failure.status != 408, failure.status != 429 {
                pendingRequest = nil; requestKey = nil
            }
            stage = .composing
            if failure.emailVerificationRequired {
                needsVerification = true
            } else if failure.proRequired {
                needsPlans = true
            } else {
                error = failure.message
                if failure.status == 402 { needsPlans = true }
            }
        } catch {
            guard creationId == attemptId, client.sessionToken == session else { return }
            stage = .composing
            self.error = "That didn’t work. Please try again."
        }
    }

    /// Follows a photo until it arrives: checks the queue often, and reloads
    /// the workspace whenever something changes. Without a running worker,
    /// it also asks the server to start the image, as the web page does.
    func watch(jobId: String, model: AppModel) {
        watcher?.cancel()
        watcher = Task { [weak self] in
            // The web nudges the queue once right after creating.
            self?.tick(model)
            var last: JobStatus?
            var checks = 0
            var misses = 0
            while !Task.isCancelled {
                guard let self else { return }
                switch model.workspace?.outcome(of: jobId, now: model.serverNow) {
                case .ready(let assetId):
                    await self.finished(jobId: jobId, assetId: assetId, model: model)
                    return
                case .failed(let message):
                    await self.failed(jobId: jobId, message: message)
                    return
                default:
                    break
                }
                let status: JobStatus? = try? await model.client.get("jobs/status")
                checks += 1
                misses = status == nil ? misses + 1 : 0
                if misses >= 4 || checks > 400 {
                    self.error = "Updates paused. Your photo may still be processing. Reconnect and check its status."
                    return
                }
                if status != nil { self.error = nil }
                let ours = status.map { $0.jobs.contains { $0.id == jobId } } ?? true
                if status != last || !ours || checks % 40 == 0 {
                    await model.refresh()
                }
                last = status
                if model.workspace?.workerHealthy == false { self.tick(model) }
                try? await Task.sleep(for: .seconds(1.5))
            }
        }
    }

    private func tick(_ model: AppModel) {
        guard ticking == nil else { return }
        ticking = Task { [weak self] in
            // Without a worker this request makes the image, so it stays
            // open for the whole render, as the web page's does.
            let _: OK? = try? await model.client.post("jobs/tick", timeout: 200)
            self?.ticking = nil
        }
    }

    private func finished(jobId: String, assetId: String, model: AppModel) async {
        stage = .result(jobId: jobId, assetId: assetId)
        if let job = model.workspace?.jobs.first(where: { $0.id == jobId }) {
            model.recordMetric("result", since: Date(timeIntervalSince1970: job.createdAt / 1000))
        }
        let seen = UIApplication.shared.applicationState == .active
        await PhotoActivities.end(jobId: jobId, ready: true, assetId: assetId, seen: seen)
    }

    private func failed(jobId: String, message: String) async {
        stage = .failed(jobId: jobId, message: message)
        await PhotoActivities.end(jobId: jobId, ready: false, assetId: nil, seen: true)
    }

    /// Stops following when the photo is no longer shown.
    func stopWatching() {
        watcher?.cancel()
        watcher = nil
    }
}
