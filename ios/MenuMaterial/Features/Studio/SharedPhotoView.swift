import MenuMaterialKit
import SwiftUI

struct SharedPhotoView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let url: URL
    @State private var photo: PreparedPhoto?
    @State private var dishId = ""
    @State private var name = ""
    @State private var error: String?
    @State private var replace = false
    var body: some View {
        NavigationStack {
            Form {
                if let photo { Image(uiImage: photo.preview).resizable().scaledToFit().clipShape(.rect(cornerRadius: 20)) }
                Section("Save this photo to") {
                    Picker("Dish", selection: $dishId) {
                        Text("New dish").tag("")
                        ForEach(model.workspace?.activeDishes ?? []) { Text($0.name).tag($0.id) }
                    }
                    if dishId.isEmpty { TextField("Dish name", text: $name) }
                }
                if let error { ErrorNote(message: error) }
                Button("Continue in Studio") {
                    if model.studio.stage != .empty { replace = true } else { use() }
                }.disabled(photo == nil || (dishId.isEmpty && name.trimmingCharacters(in: .whitespaces).isEmpty))
                Button("Discard Shared Photo", role: .destructive) {
                    do { try FileManager.default.removeItem(at: url); model.sharedPhotoURL = nil; dismiss() }
                    catch { self.error = error.localizedDescription }
                }
            }.navigationTitle("Shared Photo").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Later") { dismiss() } } }
                .confirmationDialog("Replace your current Studio draft?", isPresented: $replace, titleVisibility: .visible) { Button("Use Shared Photo", role: .destructive, action: use) }
        }.task {
            do { photo = try await PreparedPhoto.fromLibrary(Data(contentsOf: url)) }
            catch { self.error = error.localizedDescription }
        }
    }
    private func use() {
        guard let photo else { return }
        if let dish = model.workspace?.dishes.first(where: { $0.id == dishId }) {
            model.studio.select(dish: dish, workspace: model.workspace, newPhoto: true)
        } else { model.studio.startOver(); model.studio.dishName = name }
        model.studio.choose(photo); model.studio.lookId = model.profile.defaultLook
        if let failure = model.local.failure { error = failure; return }
        try? FileManager.default.removeItem(at: url)
        model.sharedPhotoURL = nil; model.tab = .studio; dismiss()
    }
}
