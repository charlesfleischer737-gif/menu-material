import Testing
import UIKit
@testable import MenuMaterial

struct PhotoPreparationTests {
    private func image(width: CGFloat, height: CGFloat, opaque: Bool = true) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = opaque
        return UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { context in
            UIColor.systemOrange.withAlphaComponent(opaque ? 1 : 0.4).setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
    }

    /// As the web makes it: at most 2048 px on the long side, JPEG.
    @Test func workingCopyIsAtMost2048Pixels() throws {
        let data = try PreparedPhoto.normalized(image(width: 4032, height: 3024))
        #expect(PreparedPhoto.fileKind(data)?.mime == "image/jpeg")
        let decoded = try #require(UIImage(data: data))
        #expect(decoded.size.width * decoded.scale == 2048)
        #expect(decoded.size.height * decoded.scale == 1536)
    }

    @Test func smallPhotosAreNeverEnlarged() throws {
        let decoded = try #require(UIImage(data: try PreparedPhoto.normalized(image(width: 800, height: 600))))
        #expect(decoded.size.width * decoded.scale == 800)
    }

    @Test func recognizesFilesByTheirFirstBytes() {
        #expect(PreparedPhoto.fileKind(Data([0xFF, 0xD8, 0xFF, 0xE0] + [UInt8](repeating: 0, count: 8)))?.ext == "jpg")
        #expect(PreparedPhoto.fileKind(Data([0x89, 0x50, 0x4E, 0x47] + [UInt8](repeating: 0, count: 8)))?.ext == "png")
        #expect(PreparedPhoto.fileKind(Data("....ftypheic....".utf8))?.mime == "image/heic")
        #expect(PreparedPhoto.fileKind(Data("RIFF....WEBP....".utf8))?.mime == "image/webp")
        #expect(PreparedPhoto.fileKind(Data("GIF89a......".utf8)) == nil)
    }

    @Test func libraryPhotosKeepTheirOriginal() async throws {
        let heicLike = try #require(image(width: 1200, height: 900).jpegData(compressionQuality: 0.9))
        let prepared = try await PreparedPhoto.fromLibrary(heicLike)
        #expect(prepared.original == heicLike)
        #expect(prepared.originalType == "image/jpeg")
        #expect(PreparedPhoto.fileKind(prepared.working)?.mime == "image/jpeg")
    }

    @Test func drawsTheMenuQRCode() throws {
        let code = try #require(QRCode.image(for: "https://menumaterial.com/m/joes-diner?src=table"))
        #expect(code.size.width == code.size.height)
        #expect(code.size.width > 500)
    }
}
