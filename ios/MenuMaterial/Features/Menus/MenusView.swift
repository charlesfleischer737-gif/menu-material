import MenuMaterialKit
import SwiftUI

/// The restaurant's menus: which are live, quick updates, and the guest
/// link and QR code. Designing and publishing stay on the web.
struct MenusView: View {
    @Environment(AppModel.self) private var model
    @State private var menus: [MenuRecord]?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let menus {
                        if menus.isEmpty {
                            EmptyState(
                                symbol: "menucard",
                                title: "No menus yet",
                                message: "Build and publish your menu on menumaterial.com. Then update prices and sold-out dishes from here."
                            ) {
                                Link("Open Menu Builder", destination: model.client.server)
                                    .buttonStyle(.primary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                        } else {
                            ForEach(menus) { menu in
                                NavigationLink(value: menu.id) {
                                    MenuCard(menu: menu)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("menu-card")
                            }
                            Text("Design and publish menus on menumaterial.com.")
                                .font(.footnote)
                                .foregroundStyle(Palette.muted)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 8)
                        }
                    } else if let error {
                        ErrorNote(message: error)
                    } else {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 24)
            }
            .canvasBackground()
            .navigationTitle("Menus")
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
            let list: MenuList = initial
                ? try await model.client.post("menus/initialize")
                : try await model.client.get("menus")
            menus = list.menus
            error = nil
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}

private struct MenuCard: View {
    let menu: MenuRecord

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 14).fill(menu.isLive ? Palette.action : Palette.raised)
                Image(systemName: "menucard")
                    .font(.title2)
                    .foregroundStyle(menu.isLive ? Palette.onAction : Palette.muted)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 4) {
                Text(menu.name)
                    .font(.headline)
                    .foregroundStyle(Palette.ink)
                HStack(spacing: 6) {
                    Circle()
                        .fill(menu.isLive ? Palette.accent : Palette.muted.opacity(0.5))
                        .frame(width: 7, height: 7)
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(Palette.muted)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.muted)
        }
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }

    private var status: String {
        var parts = [menu.isLive ? "Live" : "Draft"]
        if menu.isPrimary { parts.append("Main menu") }
        parts.append("\(menu.published?.entries.count ?? menu.draft.dishCount) dishes")
        return parts.joined(separator: " · ")
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

    private var menu: MenuRecord? { menus?.first { $0.id == menuId } }
    private var currency: String { menu?.published?.currency ?? model.restaurant?.currency ?? "USD" }

    var body: some View {
        ScrollView {
            if let menu {
                VStack(alignment: .leading, spacing: 22) {
                    header(menu)
                    if let note {
                        Label(note, systemImage: "checkmark.circle.fill")
                            .font(.callout)
                            .foregroundStyle(Palette.accent)
                    }
                    if let error { ErrorNote(message: error) }
                    if let live = menu.published {
                        Text("On the menu now").eyebrowStyle()
                        ForEach(live.sections) { section in
                            LiveSection(
                                section: section,
                                currency: currency,
                                busyEntry: busyEntry,
                                toggle: { entry, available in Task { await setAvailable(entry, available) } },
                                editPrice: { entry in editing = entry }
                            )
                        }
                        Button("Take this menu offline", role: .destructive) { showOffline = true }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 10)
                    } else {
                        Text("This menu isn’t live yet. Publish it on menumaterial.com, then update prices and sold-out dishes here.")
                            .font(.callout)
                            .foregroundStyle(Palette.muted)
                            .card()
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 32)
            }
        }
        .canvasBackground()
        .navigationTitle(menu?.name ?? "Menu")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if menu?.isLive == true {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Share", systemImage: "qrcode") { showShare = true }
                        .accessibilityIdentifier("share-menu")
                }
            }
        }
        .sheet(item: $editing) { entry in
            PriceEditor(entry: entry, currency: currency) { change in
                Task { await apply([change], success: "Price updated") }
            }
        }
        .sheet(isPresented: $showShare) {
            if let menu { MenuShareView(menu: menu) }
        }
        .confirmationDialog("Take this menu offline?", isPresented: $showOffline, titleVisibility: .visible) {
            Button("Take offline", role: .destructive) { Task { await takeOffline() } }
        } message: {
            Text("Guests can’t open it until you publish it again. Your draft is kept.")
        }
    }

    private func header(_ menu: MenuRecord) -> some View {
        HStack(spacing: 10) {
            Label(menu.isLive ? "Live" : "Draft", systemImage: menu.isLive ? "dot.radiowaves.left.and.right" : "pencil")
                .font(.footnote.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .foregroundStyle(menu.isLive ? Palette.onAction : Palette.ink)
                .background(menu.isLive ? Palette.action : Palette.raised, in: .capsule)
            if menu.isPrimary {
                Text("Main menu")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Palette.muted)
            }
            Spacer()
        }
        .padding(.top, 8)
    }

    private func setAvailable(_ entry: MenuEntry, _ available: Bool) async {
        busyEntry = entry.id
        defer { busyEntry = nil }
        await apply(
            [QuickUpdate.Change(entryId: entry.id, available: available)],
            success: available ? "\(entry.name) is back on" : "\(entry.name) is sold out"
        )
    }

    /// Sends a quick update with the menu's current revision. Another window
    /// or a My Dishes edit can move the revision, so a conflict is fetched
    /// and tried once more; the changes say what to show, so that's safe.
    private func apply(_ changes: [QuickUpdate.Change], success: String) async {
        guard let menu else { return }
        error = nil
        do {
            let updated: MenuRecord
            do {
                updated = try await model.client.post("menus/\(menuId)/live", QuickUpdate(revision: menu.revision, changes: changes))
            } catch let failure as APIError where failure.status == 409 {
                let latest: MenuRecord = try await model.client.get("menus/\(menuId)")
                replace(latest)
                updated = try await model.client.post("menus/\(menuId)/live", QuickUpdate(revision: latest.revision, changes: changes))
            }
            withAnimation { replace(updated) }
            let others = (updated.menus ?? []).map(\.name)
            note = others.isEmpty ? success : "\(success). Also updated on \(others.joined(separator: ", "))."
            Task { await model.refresh() }
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }

    private func takeOffline() async {
        guard let menu else { return }
        do {
            let _: OK = try await model.client.post("menus/\(menuId)/unpublish", RevisionRequest(revision: menu.revision))
            let latest: MenuRecord = try await model.client.get("menus/\(menuId)")
            replace(latest)
            note = "This menu is offline"
            Task { await model.refresh() }
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }

    private func replace(_ record: MenuRecord) {
        guard let index = menus?.firstIndex(where: { $0.id == record.id }) else { return }
        menus?[index] = record
    }
}

/// One section of a live menu: each dish with its price and whether it's on.
private struct LiveSection: View {
    let section: MenuSection
    let currency: String
    let busyEntry: String?
    let toggle: (MenuEntry, Bool) -> Void
    let editPrice: (MenuEntry) -> Void

    var body: some View {
        if !section.items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                if !section.name.isEmpty {
                    Text(section.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Palette.muted)
                        .padding(.bottom, 8)
                }
                VStack(spacing: 0) {
                    ForEach(section.items) { entry in
                        row(entry)
                    }
                }
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.cardRadius))
            }
        }
    }

    @ViewBuilder
    private func row(_ entry: MenuEntry) -> some View {
        EntryRow(
            entry: entry,
            currency: currency,
            busy: busyEntry == entry.id,
            toggle: { available in toggle(entry, available) },
            editPrice: { editPrice(entry) }
        )
        if entry.id != section.items.last?.id {
            Divider().padding(.leading, 16)
        }
    }
}

private struct EntryRow: View {
    let entry: MenuEntry
    let currency: String
    let busy: Bool
    let toggle: (Bool) -> Void
    let editPrice: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(entry.available ? Palette.ink : Palette.muted)
                    .strikethrough(!entry.available, color: Palette.muted)
                if let price = priceText {
                    Button(action: editPrice) {
                        HStack(spacing: 4) {
                            Text(price)
                            Image(systemName: "pencil").font(.caption2)
                        }
                        .font(.footnote)
                        .foregroundStyle(Palette.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Price \(price). Edit")
                }
            }
            Spacer()
            if busy {
                ProgressView()
            } else {
                Toggle("Available", isOn: Binding(get: { entry.available }, set: { toggle($0) }))
                    .labelsHidden()
                    .tint(Palette.accent)
                    .accessibilityLabel(entry.available ? "\(entry.name) is on the menu" : "\(entry.name) is sold out")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
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
    let save: (QuickUpdate.Change) -> Void
    @State private var single = ""
    @State private var sizes: [String: String] = [:]

    var body: some View {
        NavigationStack {
            Form {
                if entry.priceMode == "variants" {
                    ForEach(entry.variants) { variant in
                        TextField(variant.label ?? "Price", text: Binding(
                            get: { sizes[variant.id] ?? "" },
                            set: { sizes[variant.id] = $0 }
                        ))
                        .keyboardType(.decimalPad)
                    }
                } else {
                    TextField("Price", text: $single)
                        .keyboardType(.decimalPad)
                }
                Section {
                    Text("Guests see the new price right away.")
                        .font(.footnote)
                        .foregroundStyle(Palette.muted)
                }
            }
            .navigationTitle(entry.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Update") {
                        if let change { save(change); dismiss() }
                    }
                    .disabled(change == nil)
                }
            }
        }
        .presentationDetents([.medium])
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
