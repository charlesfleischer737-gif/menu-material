import MenuMaterialKit
import SwiftUI

struct ExploreStylesView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let studio: StudioModel
    var choose: (() -> Void)?
    @State private var query = ""
    @State private var category = "all"
    @State private var detail: StyleCatalog.Look?
    @State private var error: String?
    @State private var saving = false

    private var looks: [StyleCatalog.Look] {
        guard let catalog = studio.catalog else { return [] }
        let disabled = model.workspace?.studioAvailability?.disabledStyleIds ?? []
        let all = [catalog.polish] + catalog.styles
        return all.filter { look in
            !disabled.contains(look.id) && (category == "all" || look.category == category
                || (category == "favorites" && model.profile.favoriteLooks.contains(look.id))
                || (category == "recent" && model.profile.recentLooks.contains(look.id)))
                && (query.isEmpty || [look.name, look.cue, look.bestFor ?? "", look.description ?? ""].joined(separator: " ").localizedCaseInsensitiveContains(query))
        }.sorted { lhs, rhs in
            category == "recent" ? (model.profile.recentLooks.firstIndex(of: lhs.id) ?? 100) < (model.profile.recentLooks.firstIndex(of: rhs.id) ?? 100) : false
        }
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Find your restaurant’s signature look.").font(.display(.title2))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            chip("all", "All styles"); chip("favorites", "Favorites"); chip("recent", "Recent")
                            ForEach(studio.catalog?.categories ?? []) { chip($0.id, $0.name) }
                        }
                    }.scrollClipDisabled()
                    if let error { ErrorNote(message: error) }
                    if let catalogError = studio.catalogError {
                        ErrorNote(message: catalogError)
                        Button("Retry Styles") { Task { await studio.loadCatalog(model.client) } }
                    }
                    if studio.catalog == nil && studio.catalogError == nil { ProgressView().frame(maxWidth: .infinity) }
                    else if looks.isEmpty { ContentUnavailableView("No matching styles", systemImage: "paintpalette", description: Text("Try a different search or save a favorite style.").foregroundColor(Palette.muted)) }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 16, alignment: .top)], spacing: 24) {
                        ForEach(looks) { look in
                            Button { detail = look } label: {
                                VStack(alignment: .leading, spacing: 9) {
                                    StyleArtwork(path: look.thumbnail).aspectRatio(4 / 5, contentMode: .fit).clipShape(.rect(cornerRadius: 22))
                                        .overlay(alignment: .topTrailing) {
                                            if look.pro { ProBadge().padding(10) }
                                            else if look.id == model.profile.defaultLook { Image(systemName: "checkmark.seal.fill").foregroundStyle(Palette.accent).padding(10).background(Palette.surface, in: .circle).padding(8) }
                                        }
                                    Text(look.name).font(.subheadline.bold()).foregroundStyle(Palette.ink)
                                    Text(look.cue).font(.caption).foregroundStyle(Palette.muted)
                                }.frame(maxWidth: .infinity, alignment: .leading)
                            }.buttonStyle(.plain).accessibilityLabel("\(look.name), \(look.cue)\(look.pro ? ", Pro" : "")")
                        }
                    }
                }.padding(Metrics.gutter)
            }.canvasBackground().navigationTitle("Explore Styles").navigationBarTitleDisplayMode(.inline)
                .searchField(text: $query, placeholder: "Search mood, dish or occasion")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Group { Button("Done") { dismiss() } }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden) }
        }
        .task { await studio.loadCatalog(model.client) }
        .sheet(item: $detail) { look in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        StyleArtwork(path: look.image).aspectRatio(1, contentMode: .fit).clipShape(.rect(cornerRadius: Metrics.cardRadius))
                        Text(look.name).font(.display(.largeTitle))
                        Text(look.description ?? look.cue).foregroundStyle(Palette.muted)
                        if let best = look.bestFor { Label(best, systemImage: "fork.knife").font(.subheadline) }
                        if let error { ErrorNote(message: error) }
                        Button {
                            studio.lookId = look.id; detail = nil; dismiss(); choose?()
                        } label: { Text("Use this style").frame(maxWidth: .infinity) }.primaryAction()
                        HStack {
                            Button { Task { await preference(look, favorite: true) } } label: {
                                Label(model.profile.favoriteLooks.contains(look.id) ? "Saved" : "Favorite", systemImage: model.profile.favoriteLooks.contains(look.id) ? "heart.fill" : "heart")
                            }.secondaryAction()
                            Button { Task { await preference(look, favorite: false) } } label: {
                                Label(look.id == model.profile.defaultLook ? "Default look" : "Make default", systemImage: "checkmark.seal")
                            }.secondaryAction()
                        }.disabled(saving)
                        Text("A default look starts each new photo. You can still choose a different style anytime.").font(.footnote).foregroundStyle(Palette.muted)
                    }.padding(Metrics.gutter)
                }.canvasBackground().toolbar { ToolbarItem(placement: .confirmationAction) { Group { Button("Done") { detail = nil } }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden) }
            }
        }
    }
    private func chip(_ id: String, _ name: String) -> some View {
        Button { category = id } label: {
            Text(name).font(.subheadline.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                .foregroundStyle(category == id ? Color.white : Palette.ink).background(category == id ? Palette.actionFill : Palette.surface, in: .capsule)
        }.buttonStyle(.plain).accessibilityAddTraits(category == id ? .isSelected : [])
    }
    private func preference(_ look: StyleCatalog.Look, favorite: Bool) async {
        saving = true; error = nil; defer { saving = false }
        var p = model.profile
        if favorite {
            if p.favoriteLooks.contains(look.id) { p.favoriteLooks.removeAll { $0 == look.id } }
            else { p.favoriteLooks.append(look.id) }
        } else { p.defaultLook = look.id }
        do { try await model.saveProfile(p) } catch { self.error = error.localizedDescription }
    }
}

struct StyleArtwork: View {
    @Environment(AppModel.self) private var model
    let path: String
    @State private var attempt = 0
    var body: some View {
        GeometryReader { proxy in
            Group {
                if model.client.server.isFileURL, let image = UIImage(contentsOfFile: model.client.publicURL(path).path) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    AsyncImage(url: model.client.publicURL(path)) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill()
                        case .failure: Button { attempt += 1 } label: { Label("Retry preview", systemImage: "arrow.clockwise").font(.caption) }.buttonStyle(.plain).foregroundStyle(Palette.accent).frame(maxWidth: .infinity, maxHeight: .infinity)
                        default: ProgressView().tint(Palette.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }.id(attempt)
                }
            }.frame(width: proxy.size.width, height: proxy.size.height).clipped()
        }.background(Palette.surface)
    }
}

struct ExploreStylesPreview: View {
    @Environment(AppModel.self) private var model
    let studio: StudioModel
    let open: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { Text("Explore Styles").font(.title2.bold()); Spacer(); Button("See all", action: open).font(.subheadline.weight(.semibold)) }
            Text("One dish. A look that feels like you.").font(.subheadline).foregroundStyle(Palette.muted)
            if let catalog = studio.catalog {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(Array(catalog.styles.prefix(3))) { look in
                        Button(action: open) {
                            VStack(alignment: .leading, spacing: 8) {
                                StyleArtwork(path: look.thumbnail).aspectRatio(0.8, contentMode: .fit).clipShape(.rect(cornerRadius: 18))
                                Text(look.name).font(.caption.weight(.medium)).foregroundStyle(Palette.ink).lineLimit(2)
                            }
                        }.buttonStyle(.plain)
                    }
                }
            } else if let error = studio.catalogError {
                ErrorNote(message: error)
                Button("Retry Styles") { Task { await studio.loadCatalog(model.client) } }
            } else { ProgressView() }
        }
    }
}

struct ActivityView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section { Label("\(model.workspace?.remaining ?? 0) images available", systemImage: "sparkles") } footer: { Group {
                    Text("Processing photos reserve an image. Failed creations release their reservation. Open a photo to review or recover it.")
                }.foregroundStyle(Palette.muted) }
                if model.workspace?.jobs.isEmpty ?? true { ContentUnavailableView("No activity yet", systemImage: "clock") }
                ForEach(model.workspace?.jobs ?? []) { job in
                    Button {
                        model.openJob(job.id); dismiss()
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: job.isActive ? "hourglass" : job.status == "completed" ? "checkmark.circle" : "exclamationmark.circle").foregroundStyle(job.status == "failed" ? Palette.warning : Palette.accent)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(model.workspace?.dishes.first { $0.id == job.dishId }?.name ?? "Dish photo").font(.headline).foregroundStyle(Palette.ink)
                                Text(job.status.capitalized).font(.subheadline).foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Text(Date(timeIntervalSince1970: job.createdAt / 1000), style: .relative).font(.caption).foregroundStyle(Palette.muted)
                        }.padding(.vertical, 4)
                    }
                }
            }.navigationTitle("Activity").refreshable { await model.refresh() }
                .toolbar { ToolbarItem(placement: .confirmationAction) { Group { Button("Done") { dismiss() } }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden) }
        }
    }
}
