import CoreImage.CIFilterBuiltins
import MenuMaterialKit
import SwiftUI

/// A live menu's guest link and QR code, tagged with where it's used so
/// the menu's visit counts can tell them apart. The code sits on a card
/// like a Wallet pass.
struct MenuShareView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let menu: MenuRecord
    @State private var placement: MenuPlacement = .table
    @State private var copied: String?

    private var link: URL? {
        guard let origin = model.workspace?.menuOrigin, let slug = model.restaurant?.slug else { return nil }
        return MenuLinks.guestURL(origin: origin, slug: slug, menu: menu, placement: placement)
    }

    private var code: UIImage? {
        guard placement.printed, let link else { return nil }
        return QRCode.image(for: link.absoluteString)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    if let link {
                        MenuPass(
                            restaurant: model.restaurant?.name ?? "",
                            menu: menu.name,
                            placement: placement.label,
                            link: link,
                            code: code
                        )
                        .animation(.smooth, value: placement)

                        placementPicker

                        VStack(spacing: 12) {
                            if let code {
                                ShareLink(
                                    item: Image(uiImage: code),
                                    preview: SharePreview("\(menu.name) QR code", image: Image(uiImage: code))
                                ) {
                                    Label("Share QR Code", systemImage: "qrcode")
                                        .frame(maxWidth: .infinity)
                                }
                                .primaryAction()
                            }
                            HStack(spacing: 12) {
                                Button {
                                    UIPasteboard.general.url = link
                                    copied = "Link copied"
                                } label: {
                                    Label("Copy Link", systemImage: "doc.on.doc")
                                        .frame(maxWidth: .infinity)
                                }
                                .secondaryAction()
                                ShareLink(item: link) {
                                    Label("Share Link", systemImage: "square.and.arrow.up")
                                        .frame(maxWidth: .infinity)
                                }
                                .modifier(ShareLinkStyle(prominent: code == nil))
                            }
                            Link(destination: link) {
                                Label("Open the Guest Page", systemImage: "safari")
                            }
                            .font(.subheadline.weight(.semibold))
                            .padding(.top, 4)
                        }
                    } else {
                        ContentUnavailableView {
                            Label("Address Not Ready", systemImage: "link")
                        } description: {
                            Text("Your menu’s address isn’t ready yet. Pull to refresh, or open Menus on menumaterial.com.")
                        }
                    }
                }
                .padding(.horizontal, Metrics.gutter + 4)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .canvasBackground()
            .refreshable { await model.refresh() }
            .navigationTitle("Share Menu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", systemImage: "checkmark") { dismiss() }
                        .accessibilityLabel("Done")
                }
            }
            .toast($copied)
        }
    }

    private var placementPicker: some View {
        HStack {
            Text("Where guests find it")
                .foregroundStyle(Palette.ink)
            Spacer()
            Picker("Where guests find it", selection: $placement) {
                ForEach(MenuPlacement.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.menu)
            .labelsHidden()
        }
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .frame(minHeight: Metrics.rowHeight)
        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
    }
}

/// The prominent style when the link is the main thing to share.
private struct ShareLinkStyle: ViewModifier {
    let prominent: Bool

    func body(content: Content) -> some View {
        if prominent {
            content.primaryAction()
        } else {
            content.secondaryAction()
        }
    }
}

/// The menu's code on a pass: restaurant, menu, where it's used, and the
/// QR code (or, for links shared online, the address).
private struct MenuPass: View {
    let restaurant: String
    let menu: String
    let placement: String
    let link: URL
    let code: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 10) {
                BrandMark(height: 18)
                Text(restaurant)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer()
                Text(placement.uppercased())
                    .font(.caption2.weight(.bold))
                    .tracking(0.8)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(.white.opacity(0.16), in: .capsule)
                    .contentTransition(.opacity)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("MENU")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.6))
                Text(menu)
                    .font(.display(.title))
                    .lineLimit(2)
            }
            if let code {
                Image(uiImage: code)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .padding(10)
                    .background(.white, in: .rect(cornerRadius: 18))
                    .frame(maxWidth: 240)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("QR code for \(menu)")
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
                Text("Scan to see the menu")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(maxWidth: .infinity)
            } else {
                Text(link.absoluteString)
                    .font(.callout.monospaced())
                    .foregroundStyle(.white.opacity(0.85))
                    .textSelection(.enabled)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.1), in: .rect(cornerRadius: 14))
            }
        }
        .padding(22)
        .foregroundStyle(.white)
        .background {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 0.09, green: 0.33, blue: 0.22), Color(red: 0.03, green: 0.13, blue: 0.09)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                RadialGradient(
                    colors: [Color(red: 0.86, green: 0.62, blue: 0.27).opacity(0.35), .clear],
                    center: .topTrailing,
                    startRadius: 10,
                    endRadius: 260
                )
            }
        }
        .clipShape(.rect(cornerRadius: 28))
        .shadow(color: .black.opacity(0.2), radius: 24, y: 14)
    }
}

enum QRCode {
    /// Medium error correction in the site's evergreen on white, as the web
    /// draws it, with a quiet zone of four modules.
    static func image(for text: String, pixelsPerModule: CGFloat = 20) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let code = filter.outputImage else { return nil }
        let colored = code.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0.094, green: 0.243, blue: 0.192),
            "inputColor1": CIColor(red: 1, green: 1, blue: 1),
        ])
        let scaled = colored.transformed(by: CGAffineTransform(scaleX: pixelsPerModule, y: pixelsPerModule))
        guard let cgImage = CIContext().createCGImage(scaled, from: scaled.extent) else { return nil }
        let margin = 4 * pixelsPerModule
        let size = CGSize(width: scaled.extent.width + margin * 2, height: scaled.extent.height + margin * 2)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.interpolationQuality = .none
            UIImage(cgImage: cgImage).draw(in: CGRect(x: margin, y: margin, width: scaled.extent.width, height: scaled.extent.height))
        }
    }
}
