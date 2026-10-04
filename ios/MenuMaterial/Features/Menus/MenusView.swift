import MenuMaterialKit
import SwiftUI

/// The restaurant's menus: which are live, quick updates, and the guest
/// link and QR code, with safe draft edits and explicit publication.
struct MenusView: View {
    @Environment(AppModel.self) private var model
    @State private var menus: [MenuRecord]?
    @State private var error: String?
    @State private var createMenu = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let menus {
                        if menus.isEmpty {
                            ContentUnavailableView {
                                Label("No Menus Yet", systemImage: "menucard")
                            } description: {
                                Text("Choose dishes, review the details, and publish a menu your guests can open anywhere.")
                            } actions: {
                                Button("Create a Menu") { createMenu = true }.primaryAction()
                            }
                            .padding(.top, 40)
                        } else {
                            ForEach(menus) { menu in
                                NavigationLink(value: menu.id) {
                                    MenuCard(menu: menu)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("menu-card")
                            }
                            Label("More menu design options on menumaterial.com.", systemImage: "safari")
                                .font(.footnote)
                                .foregroundStyle(Palette.muted)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 6)
                        }
                    } else if error == nil {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                    }
                    if let error {
                        ErrorNote(message: error)
                        Button("Retry Menus") { Task { await load(initial: false) } }
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 4)
                .padding(.bottom, 24)
            }
            .canvasBackground()
            .navigationTitle("Menus")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("New Menu", systemImage: "plus") { createMenu = true } } }
            .sheet(isPresented: $createMenu) { MenuEditorView { created in
                if menus == nil { menus = [] }; menus?.insert(created, at: 0)
            } }
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await load(initial: false) } } }
            .onChange(of: model.tab) { _, tab in if tab == .menus { Task { await load(initial: false) } } }
            .refreshable { await load(initial: false) }
            .navigationDestination(for: String.self) { id in
                MenuDetailView(menuId: id, menus: $menus)
            }
            .task { if menus == nil { await load(initial: true) } }
        }
    }

    /// The first time, menus are set up from anything made before Menus
    /// existed, as the web does.
    private func load(initial: Bool) async {
        do {
            if menus == nil, let cached = model.local.data("menus.json") { menus = (try? APIClient.decode(MenuList.self, from: cached))?.menus }
            let data = try await model.client.send(model.client.request(initial ? .post : .get, initial ? "menus/initialize" : "menus", body: initial ? Data("{}".utf8) : nil))
            let list = try APIClient.decode(MenuList.self, from: data)
            model.local.save(data, "menus.json")
            withAnimation(.smooth) { menus = list.menus }
            error = nil
        } catch let failure as APIError {
            error = failure.message
        } catch { self.error = error.localizedDescription }
    }
}

/// A menu as a card: a few of its dishes, its name, and whether guests see it.
private struct MenuCard: View {
    let menu: MenuRecord

    private var entries: [MenuEntry] { menu.published?.entries ?? menu.draft.sections.flatMap(\.items) }
    private var photos: [String] { Array(entries.compactMap(\.photoId).prefix(3)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PhotoMosaic(ids: photos)
                .frame(height: 168)
                .overlay(alignment: .topLeading) {
                    if menu.isPrimary {
                        Text("Main Menu")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .glassEffect(.regular, in: .capsule)
                            .padding(12)
                    }
                }
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(menu.name)
                        .font(.headline)
                        .foregroundStyle(Palette.ink)
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(Palette.muted)
                }
                Spacer()
                StatusPill(text: menu.isLive ? "Live" : "Draft", color: menu.isLive ? Palette.accent : .secondary)
            }
            .padding(16)
        }
        .background(Palette.surface)
        .clipShape(.rect(cornerRadius: Metrics.cardRadius))
        .accessibilityElement(children: .combine)
    }

    private var summary: String {
        let count = entries.count
        let soldOut = entries.filter { !$0.available }.count
        var parts = [count == 1 ? "1 dish" : "\(count) dishes"]
        if soldOut > 0 { parts.append("\(soldOut) sold out") }
        return parts.joined(separator: " · ")
    }
}

/// Up to three photos: one large, two stacked beside it.
struct PhotoMosaic: View {
    let ids: [String]

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 2) {
                tile(ids.first)
                if ids.count > 1 {
                    VStack(spacing: 2) {
                        tile(ids[1])
                        if ids.count > 2 { tile(ids[2]) }
                    }
                    .frame(width: proxy.size.width * 0.38)
                }
            }
        }
    }

    private func tile(_ id: String?) -> some View {
        Color.clear
            .overlay {
                if let id {
                    AssetImage(id: id)
                } else {
                    ZStack {
                        Palette.raised
                        Image(systemName: "menucard")
                            .font(.largeTitle)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .clipped()
    }
}

/// One menu: quick updates to what guests see, and how to reach it.
struct MenuDetailView: View {
    @Environment(AppModel.self) private var model
    let menuId: String
    @Binding var menus: [MenuRecord]?
    @State private var busyEntry: String?
    @State private var editing: MenuEntry?
    @State private var note: String?
    @State private var error: String?
    @State private var showOffline = false
    @State private var showShare = false
    @State private var editMenu = false
    @State private var publishMenu = false
    @State private var busy = false

    private var menu: MenuRecord? { menus?.first { $0.id == menuId } }
    private var currency: String { menu?.published?.currency ?? model.restaurant?.currency ?? "USD" }

    var body: some View {
        List {
            if let menu {
                Section {
                    summary(menu)
                }
                if let error {
                    Section { ErrorNote(message: error) }
                }
                Section {
                    Button("Edit Dishes and Photos", systemImage: "pencil") { editMenu = true }
                    Button(menu.isLive ? "Review and Republish" : "Review and Publish", systemImage: "checkmark.seal") { publishMenu = true }
                    if menu.isLive && !menu.isUpToDate { Text("This menu has unpublished changes.").font(.footnote).foregroundStyle(Palette.warning) }
                }
                if let live = menu.published {
                    ForEach(live.sections.filter { !$0.items.isEmpty }) { section in
                        LiveSection(
                            section: section,
                            currency: currency,
                            busyEntry: busyEntry,
                            setAvailable: { entry, available in Task { await setAvailable(entry, available) } },
                            editPrice: { entry in editing = entry }
                        )
                    }
                    Section {
                        Button("Take Menu Offline", role: .destructive) { showOffline = true }.disabled(busy)
                    } footer: {
                        Text("Prices and sold-out dishes change for guests right away. Design changes are made on menumaterial.com.")
                    }
                } else {
                    Section {
                        Text("This draft is saved. Review its dishes and photos, then publish when it’s ready.")
                            .foregroundStyle(Palette.muted)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(menu?.name ?? "Menu")
        .sheet(item: $editing) { entry in
            PriceEditor(entry: entry, currency: currency) { change in
                try await apply([change], success: "Price updated")
            }
        }
        .sheet(isPresented: $editMenu) { if let menu { MenuEditorView(menu: menu) { replace($0) } } }
        .sheet(isPresented: $publishMenu) { if let menu { MenuPublishView(menu: menu) { replace($0); note = "Menu published" } } }
        .sheet(isPresented: $showShare) {
            if let menu { MenuShareView(menu: menu) }
        }
        .confirmationDialog("Take this menu offline?", isPresented: $showOffline, titleVisibility: .visible) {
            Button("Take Offline", role: .destructive) { Task { await takeOffline() } }
        } message: {
            Text("Guests can’t open it until you publish it again. Your draft is kept.")
        }
        .toast($note)
    }

    private func summary(_ menu: MenuRecord) -> some View {
        let entries = menu.published?.entries ?? []
        let soldOut = entries.filter { !$0.available }.count
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                StatusPill(text: menu.isLive ? "Live" : "Draft", color: menu.isLive ? Palette.accent : .secondary)
                if menu.isPrimary {
                    Text("Main menu")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Palette.muted)
                }
                Spacer()
            }
            HStack(spacing: 0) {
                stat("\(entries.count)", "Dishes")
                Divider().frame(height: 32)
                stat("\(soldOut)", "Sold out")
                Divider().frame(height: 32)
                stat(updated(menu), "Published")
            }
            if menu.isLive {
                Button {
                    showShare = true
                } label: {
                    Label("Share Menu and QR Code", systemImage: "qrcode")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .controlSize(.large)
                .accessibilityIdentifier("share-menu")
            }
        }
        .padding(.vertical, 6)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text(label)
                .font(.caption)
                .foregroundStyle(Palette.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private func updated(_ menu: MenuRecord) -> String {
        guard let at = menu.publishedAt else { return "–" }
        return Date(timeIntervalSince1970: at / 1000).formatted(.dateTime.month(.abbreviated).day())
    }

    private func setAvailable(_ entry: MenuEntry, _ available: Bool) async {
        busyEntry = entry.id
        defer { busyEntry = nil }
        do {
            try await apply([QuickUpdate.Change(entryId: entry.id, available: available)], success: available ? "\(entry.name) is back on" : "\(entry.name) is sold out")
        } catch { self.error = error.localizedDescription }
    }

    /// Sends a quick update with the menu's current revision. Another window
    /// or a My Dishes edit can move the revision. Fetch a conflict and keep
    /// the editor open so the owner can review and retry deliberately.
    private func apply(_ changes: [QuickUpdate.Change], success: String) async throws {
        guard let menu else { return }
        error = nil
        do {
            let updated: MenuRecord
            do {
                updated = try await model.client.post("menus/\(menuId)/live", QuickUpdate(revision: menu.revision, changes: changes))
            } catch let failure as APIError where failure.status == 409 {
                let latest: MenuRecord = try await model.client.get("menus/\(menuId)")
                replace(latest)
                throw failure
            }
            withAnimation { replace(updated) }
            let others = (updated.menus ?? []).map(\.name)
            note = others.isEmpty ? success : "\(success) · also \(others.joined(separator: ", "))"
            Task { await model.refresh() }
        } catch let failure as APIError {
            error = failure.message
            throw failure
        } catch { self.error = error.localizedDescription; throw error }
    }

    private func takeOffline() async {
        guard let menu else { return }
        busy = true; defer { busy = false }
        do {
            let _: OK = try await model.client.post("menus/\(menuId)/unpublish", RevisionRequest(revision: menu.revision))
            let latest: MenuRecord = try await model.client.get("menus/\(menuId)")
            replace(latest)
            note = "This menu is offline"
            Task { await model.refresh() }
        } catch let failure as APIError {
            error = failure.message
        } catch { self.error = error.localizedDescription }
    }

    private func replace(_ record: MenuRecord) {
        guard let index = menus?.firstIndex(where: { $0.id == record.id }) else { return }
        menus?[index] = record
    }
}

/// One section of a live menu. Swiping a dish marks it sold out or back on.
private struct LiveSection: View {
    let section: MenuSection
    let currency: String
    let busyEntry: String?
    let setAvailable: (MenuEntry, Bool) -> Void
    let editPrice: (MenuEntry) -> Void

    var body: some View {
        Section {
            ForEach(section.items) { entry in
                EntryRow(
                    entry: entry,
                    currency: currency,
                    busy: busyEntry == entry.id,
                    toggle: { available in setAvailable(entry, available) },
                    editPrice: { editPrice(entry) }
                )
                .swipeActions(edge: .trailing) {
                    Button(entry.available ? "Sold Out" : "Back On") {
                        setAvailable(entry, !entry.available)
                    }
                    .tint(entry.available ? Palette.warning : Palette.accent)
                }
            }
        } header: {
            Text(section.name)
        }
    }
}

/// A dish on a live menu: its photo, price and whether it's on.
private struct EntryRow: View {
    let entry: MenuEntry
    let currency: String
    let busy: Bool
    let toggle: (Bool) -> Void
    let editPrice: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            SquarePhoto(id: entry.photoId, radius: 10)
                .frame(width: 48, height: 48)
                .saturation(entry.available ? 1 : 0)
                .opacity(entry.available ? 1 : 0.6)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(entry.available ? Palette.ink : Palette.muted)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let price = priceText {
                        Button(action: editPrice) {
                            HStack(spacing: 3) {
                                Text(price)
                                Image(systemName: "pencil").font(.caption2.weight(.semibold))
                            }
                            .font(.subheadline)
                            .foregroundStyle(Palette.accent)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Price \(price). Edit")
                    }
                    if !entry.available {
                        Text("Sold out")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Palette.warning)
                    }
                }
            }
            Spacer(minLength: 8)
            if busy {
                ProgressView()
            } else {
                Toggle("Available", isOn: Binding(get: { entry.available }, set: { toggle($0) }))
                    .labelsHidden()
                    .tint(Palette.accent)
                    .accessibilityLabel(entry.available ? "\(entry.name) is on the menu" : "\(entry.name) is sold out")
            }
        }
        .padding(.vertical, 2)
    }

    private var priceText: String? {
        switch entry.priceMode {
        case "single":
            entry.price.map { Money.format(hundredths: $0, currency: currency) }
        case "variants":
            entry.variants.isEmpty
                ? nil
                : entry.variants.map { "\($0.label ?? "") \(Money.format(hundredths: $0.price, currency: currency))" }
                    .joined(separator: " · ")
        default:
            nil
        }
    }
}

/// A new price for one dish, or for each of its sizes.
private struct PriceEditor: View {
    @Environment(\.dismiss) private var dismiss
    let entry: MenuEntry
    let currency: String
    let save: (QuickUpdate.Change) async throws -> Void
    @State private var busy = false
    @State private var error: String?
    @State private var single = ""
    @State private var sizes: [String: String] = [:]

    var body: some View {
        NavigationStack {
            Form {
                if let error { Section { ErrorNote(message: error) } }
                Section {
                    if entry.priceMode == "variants" {
                        ForEach(entry.variants) { variant in
                            LabeledContent(variant.label ?? "Price") {
                                TextField("Price", text: Binding(
                                    get: { sizes[variant.id] ?? "" },
                                    set: { sizes[variant.id] = $0 }
                                ))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                            }
                        }
                    } else {
                        LabeledContent("Price") {
                            TextField("Price", text: $single)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                } footer: {
                    Text("Guests see the new price right away.")
                }
            }
            .navigationTitle(entry.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Update", systemImage: "checkmark") {
                        guard let change else { return }
                        busy = true
                        Task {
                            defer { busy = false }
                            do { try await save(change); dismiss() }
                            catch { self.error = error.localizedDescription }
                        }
                    }
                    .disabled(change == nil || busy)
                }
            }
        }
        .interactiveDismissDisabled(busy)
        .presentationDetents([.medium, .large])
        .onAppear {
            if let price = entry.price { single = String(format: "%.2f", Double(price) / 100) }
            for variant in entry.variants {
                sizes[variant.id] = String(format: "%.2f", Double(variant.price) / 100)
            }
        }
    }

    private var change: QuickUpdate.Change? {
        if entry.priceMode == "variants" {
            var prices: [QuickUpdate.VariantPrice] = []
            for variant in entry.variants {
                guard let value = Money.hundredths(from: sizes[variant.id] ?? ""), value >= 1 else { return nil }
                prices.append(QuickUpdate.VariantPrice(id: variant.id, price: value))
            }
            return prices.isEmpty ? nil : QuickUpdate.Change(entryId: entry.id, variants: prices)
        }
        guard let value = Money.hundredths(from: single), value >= 1 else { return nil }
        return QuickUpdate.Change(entryId: entry.id, price: value)
    }
}
