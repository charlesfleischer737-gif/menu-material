"""Requires fonttools[woff]. Keeps the original TTFs for exports and native tests."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

for source in Path("public/fonts/social").glob("*.ttf"):
    font = TTFont(source, recalcTimestamp=False)
    font.flavor = "woff2"
    target = source.with_suffix(".woff2")
    font.save(target)
    restored = TTFont(target)
    assert font.getGlyphOrder() == restored.getGlyphOrder()
    assert font.getBestCmap() == restored.getBestCmap()
    assert font["hmtx"].metrics == restored["hmtx"].metrics
    original_glyphs, web_glyphs = font.getGlyphSet(), restored.getGlyphSet()
    for name in font.getGlyphOrder():
        before, after = RecordingPen(), RecordingPen()
        original_glyphs[name].draw(before)
        web_glyphs[name].draw(after)
        assert before.value == after.value, f"Changed glyph: {source.name}/{name}"
    print(f"{target.name}: {target.stat().st_size:,} bytes; character maps, widths and outlines verified")
