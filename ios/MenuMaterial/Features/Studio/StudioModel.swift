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
    enum Stage: Equatable {
        case empty
        case composing
        case submitting
        case creating(jobId: String)
        case result(jobId: String, assetId: String)
        case failed(jobId: String, message: String)
    }

    var stage: Stage = .empty
    private(set) var catalog: StyleCatalog?
    var lookId = "keep"
    var format: PhotoFormat = .menu
    var note = ""
    var dishName = ""
    var error: String?
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

    var look: StyleCatalog.Look? { catalog?.look(id: lookId) }

    func loadCatalog(_ client: APIClient) async {
        guard catalog == nil else { return }
        catalog = try? await client.get("native/styles")
    }

    // MARK: Choosing a photo

    func choose(_ prepared: PreparedPhoto) {
        photo = prepared
        sourceId = nil
        dishId = nil
        uploadKey = nil
        error = nil
        stage = .composing
    }

    func startOver() {
        watcher?.cancel()
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
        guard stage == .empty, let workspace = model.workspace else { return }
        let recent = workspace.jobs.first {
            $0.isActive && model.serverNow - $0.createdAt < 30 * 60 * 1000
        }
        if let recent { open(jobId: recent.id, model: model) }
    }

    // MARK: Making the photo

    func create(model: AppModel) async {
        guard let look, sourceId != nil || photo != nil else { return }
        error = nil
        stage = .submitting
        let client = model.client
        do {
            if dishId == nil {
                let name = dishName.trimmingCharacters(in: .whitespacesAndNewlines)
                var save = DishSave(newDishNamed: name.isEmpty ? "Untitled dish" : String(name.prefix(100)))
                save.setting = String(look.photoStyle.prefix(300))
                let reply: DishSaveResult = try await client.post("dishes", save)
                dishId = reply.id
            }
            if sourceId == nil, let photo, let dishId {
                let key = uploadKey ?? UUID().uuidString.lowercased()
                uploadKey = key
                let reply: UploadReply = try await client.upload(
                    "assets",
                    form: .dishPhoto(photo, dishId: dishId, requestKey: key)
                )
                sourceId = reply.id
                if let image = UIImage(data: photo.working) {
                    model.images.remember(image, asset: reply.id)
                }
            }
            guard let dishId, let sourceId else { return }
            let job: JobReply = try await client.post(
                "jobs",
                PhotoRequest(look: look, format: format, note: note, dishId: dishId, sourceId: sourceId)
            )
            await model.refresh()
            if case .ready(let assetId) = model.workspace?.outcome(of: job.id, now: model.serverNow) {
                // The same photo in the same look was made before: no image used.
                stage = .result(jobId: job.id, assetId: assetId)
                return
            }
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
